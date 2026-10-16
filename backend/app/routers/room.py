from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session

from app.core.constants import (
    ROOM_STATUS_IN_PROGRESS,
    ROUND_STATUS_IN_PROGRESS,
)
from app.db.dependencies import get_db
from app.db.session import SessionLocal
from app.models.game_room import GameRoom
from app.models.game_round import GameRound
from app.repositories.player_repository import PlayerRepository
from app.schemas.game_state import GameStateResponse
from app.schemas.guess import GuessResponse, GuessSubmitRequest
from app.schemas.leaderboard import LeaderboardResponse
from app.schemas.player import (
    PlayerJoinRequest,
    PlayerJoinResponse,
    PlayerReadyRequest,
    PlayerResponse,
    RoomPlayerListResponse,
)
from app.schemas.room import (
    GameStartResponse,
    RoomCreateRequest,
    RoomListResponse,
    RoomResponse,
)
from app.services.connection_manager import manager
from app.services.game_state_service import GameStateService
from app.services.guess_service import GuessService
from app.services.leaderboard_service import LeaderboardService
from app.services.room_service import RoomService
from app.services.round_timer_service import (
    ROUND_DURATION_SECONDS,
    round_timer_service,
)
from app.schemas.round_history import RoundHistoryResponse
from app.services.round_history_service import RoundHistoryService
from app.services.round_event_service import broadcast_round_ended

from app.schemas.guess_history import GuessHistoryResponse
from app.services.guess_history_service import GuessHistoryService

from app.schemas.game_results import GameResultsResponse
from app.services.game_results_service import GameResultsService

router = APIRouter(
    prefix="/rooms",
    tags=["Rooms"],
)


async def send_secret_word_to_drawer(
    room_code: str,
    round_id: int,
    drawer_id: int,
) -> None:
    """
    Send the secret word privately to the assigned drawer.

    Never broadcast the secret word to the entire room.
    """

    db: Session = SessionLocal()

    try:
        current_round = db.get(GameRound, round_id)

        if (
            current_round is None
            or current_round.status != ROUND_STATUS_IN_PROGRESS
            or current_round.drawer_id != drawer_id
            or not current_round.secret_word
        ):
            return

        current_room = db.get(GameRoom, current_round.room_id)

        if (
            current_room is None
            or current_room.status != ROOM_STATUS_IN_PROGRESS
            or current_room.room_code.strip().upper()
            != room_code.strip().upper()
        ):
            return

        message = {
            "type": "secret_word",
            "round_id": current_round.id,
            "round_number": current_round.round_number,
            "word": current_round.secret_word,
        }

    finally:
        db.close()

    await manager.send_to_player(
        room_code=room_code,
        player_id=drawer_id,
        message=message,
    )


async def broadcast_player_joined(
    room_code: str,
    player_id: int,
    display_name: str,
    is_ready: bool,
    total_players: int,
) -> None:
    """Notify connected players when someone joins the room."""

    await manager.broadcast(
        room_code=room_code,
        message={
            "type": "player_joined",
            "player": {
                "id": player_id,
                "display_name": display_name,
                "is_ready": is_ready,
            },
            "total_players": total_players,
        },
    )


async def broadcast_player_ready(
    room_code: str,
    player_id: int,
    display_name: str,
    is_ready: bool,
) -> None:
    """Notify connected players when a player's readiness changes."""

    await manager.broadcast(
        room_code=room_code,
        message={
            "type": "player_ready",
            "player_id": player_id,
            "display_name": display_name,
            "is_ready": is_ready,
        },
    )


async def broadcast_player_left(
    room_code: str,
    player_id: int,
    display_name: str,
    total_players: int,
) -> None:
    """Notify connected players when someone leaves the room."""

    await manager.broadcast(
        room_code=room_code,
        message={
            "type": "player_left",
            "player_id": player_id,
            "display_name": display_name,
            "total_players": total_players,
        },
    )


async def broadcast_guess_result(
    room_code: str,
    round_id: int,
    player_id: int,
    display_name: str,
    guess_text: str,
    is_correct: bool,
    points_awarded: int,
) -> None:
    """
    Broadcast a guess result without exposing the correct word
    through the correct-guess notification.
    """

    if is_correct:
        message = {
            "type": "correct_guess",
            "round_id": round_id,
            "player_id": player_id,
            "display_name": display_name,
            "points_awarded": points_awarded,
        }
    else:
        message = {
            "type": "guess_submitted",
            "round_id": round_id,
            "player_id": player_id,
            "display_name": display_name,
            "guess_text": guess_text,
            "is_correct": False,
            "points_awarded": 0,
        }

    await manager.broadcast(
        room_code=room_code,
        message=message,
    )


@router.get(
    "",
    response_model=RoomListResponse,
    status_code=status.HTTP_200_OK,
)
def get_all_rooms(
    db: Session = Depends(get_db),
):
    return RoomService.get_all_rooms(db=db)


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_room(
    request: RoomCreateRequest,
    db: Session = Depends(get_db),
):
    return RoomService.create_room(
        db=db,
        max_players=request.max_players,
        total_rounds=request.total_rounds,
    )


@router.post(
    "/{room_code}/join",
    response_model=PlayerJoinResponse,
    status_code=status.HTTP_201_CREATED,
)
async def join_room(
    room_code: str,
    request: PlayerJoinRequest,
    db: Session = Depends(get_db),
):
    player = RoomService.join_room(
        db=db,
        room_code=room_code,
        display_name=request.display_name,
    )

    total_players = PlayerRepository.count_by_room(
        db=db,
        room_id=player.room_id,
    )

    await broadcast_player_joined(
        room_code=room_code.strip().upper(),
        player_id=player.id,
        display_name=player.display_name,
        is_ready=player.is_ready,
        total_players=total_players,
    )

    return player


@router.patch(
    "/{room_code}/ready",
    response_model=PlayerResponse,
    status_code=status.HTTP_200_OK,
)
async def set_player_ready(
    room_code: str,
    request: PlayerReadyRequest,
    session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    player = RoomService.set_player_ready(
        db=db,
        room_code=room_code,
        session_token=session_token,
        is_ready=request.is_ready,
    )

    await broadcast_player_ready(
        room_code=room_code.strip().upper(),
        player_id=player.id,
        display_name=player.display_name,
        is_ready=player.is_ready,
    )

    return player


@router.delete(
    "/{room_code}/players/me",
    status_code=status.HTTP_200_OK,
)
async def leave_room(
    room_code: str,
    session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    player = PlayerRepository.get_by_session_token(
        db=db,
        session_token=session_token,
    )

    if player is None:
        return RoomService.leave_room(
            db=db,
            room_code=room_code,
            session_token=session_token,
        )

    player_id = player.id
    display_name = player.display_name
    player_room_id = player.room_id

    result = RoomService.leave_room(
        db=db,
        room_code=room_code,
        session_token=session_token,
    )

    total_players = PlayerRepository.count_by_room(
        db=db,
        room_id=player_room_id,
    )

    await broadcast_player_left(
        room_code=result["room_code"],
        player_id=player_id,
        display_name=display_name,
        total_players=total_players,
    )

    return result


@router.post(
    "/{room_code}/start",
    response_model=GameStartResponse,
    status_code=status.HTTP_200_OK,
)
async def start_game(
    room_code: str,
    session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    result = RoomService.start_game(
        db=db,
        room_code=room_code,
        session_token=session_token,
    )

    # Start the first round's server-side countdown.
    await round_timer_service.start_or_resume(
        room_code=result["room_code"],
        round_id=result["round_id"],
    )

    # Deliver the secret word privately to the drawer.
    await send_secret_word_to_drawer(
        room_code=result["room_code"],
        round_id=result["round_id"],
        drawer_id=result["drawer_id"],
    )

    await manager.broadcast(
        room_code=result["room_code"],
        message={
            "type": "game_started",
            "room_code": result["room_code"],
            "current_round": result["current_round"],
            "total_rounds": result["total_rounds"],
            "round_id": result["round_id"],
            "drawer_id": result["drawer_id"],
            "duration_seconds": ROUND_DURATION_SECONDS,
        },
    )

    return result


@router.get(
    "/{room_code}",
    response_model=RoomResponse,
    status_code=status.HTTP_200_OK,
)
def get_room(
    room_code: str,
    db: Session = Depends(get_db),
):
    return RoomService.get_room(
        db=db,
        room_code=room_code,
    )


@router.get(
    "/{room_code}/players",
    response_model=RoomPlayerListResponse,
    status_code=status.HTTP_200_OK,
)
def get_room_players(
    room_code: str,
    db: Session = Depends(get_db),
):
    room, players = RoomService.get_room_players(
        db=db,
        room_code=room_code,
    )

    return RoomPlayerListResponse(
        room_code=room.room_code,
        total_players=len(players),
        players=[
            PlayerResponse.model_validate(player)
            for player in players
        ],
    )


@router.post(
    "/{room_code}/rounds/{round_id}/guesses",
    response_model=GuessResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_guess(
    room_code: str,
    round_id: int,
    request: GuessSubmitRequest,
    session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    guess = GuessService.submit_guess(
        db=db,
        room_code=room_code,
        round_id=round_id,
        session_token=session_token,
        guess_text=request.guess_text,
    )

    player = PlayerRepository.get_by_id(
        db=db,
        player_id=guess.player_id,
    )

    if player is not None:
        await broadcast_guess_result(
            room_code=room_code.strip().upper(),
            round_id=guess.round_id,
            player_id=guess.player_id,
            display_name=player.display_name,
            guess_text=guess.guess_text,
            is_correct=guess.is_correct,
            points_awarded=guess.points_awarded,
        )

    return guess


@router.post(
    "/{room_code}/rounds/{round_id}/finish",
    status_code=status.HTTP_200_OK,
)
async def finish_round(
    room_code: str,
    round_id: int,
    session_token: str = Header(..., alias="X-Session-Token"),
    db: Session = Depends(get_db),
):
    result = RoomService.finish_round(
        db=db,
        room_code=room_code,
        round_id=round_id,
        session_token=session_token,
    )

    # Reveal the word and the round's points to everyone.
    await broadcast_round_ended(
        room_code=result["room_code"],
        round_id=result["completed_round_id"],
    )

    # The previous round has ended. Stop its countdown before
    # starting the timer for the next round.
    await round_timer_service.cancel(room_code)

    next_round_id = result.get("next_round_id")
    next_drawer_id = result.get("next_drawer_id")

    if next_round_id is not None and next_drawer_id is not None:
        await round_timer_service.start_or_resume(
            room_code=result["room_code"],
            round_id=next_round_id,
        )

        await send_secret_word_to_drawer(
            room_code=result["room_code"],
            round_id=next_round_id,
            drawer_id=next_drawer_id,
        )

        await manager.broadcast(
            room_code=result["room_code"],
            message={
                "type": "round_started",
                "room_code": result["room_code"],
                "current_round": result["current_round"],
                "total_rounds": result["total_rounds"],
                "round_id": next_round_id,
                "drawer_id": next_drawer_id,
                "duration_seconds": ROUND_DURATION_SECONDS,
            },
        )

    else:
        await manager.broadcast(
            room_code=result["room_code"],
            message={
                "type": "game_completed",
                "room_code": result["room_code"],
                "current_round": result["current_round"],
                "total_rounds": result["total_rounds"],
            },
        )

    return result


@router.get(
    "/{room_code}/leaderboard",
    response_model=LeaderboardResponse,
    status_code=status.HTTP_200_OK,
)
def get_leaderboard(
    room_code: str,
    db: Session = Depends(get_db),
):
    return LeaderboardService.get_leaderboard(
        db=db,
        room_code=room_code,
    )


@router.get(
    "/{room_code}/game-state",
    response_model=GameStateResponse,
    status_code=status.HTTP_200_OK,
)
def get_game_state(
    room_code: str,
    db: Session = Depends(get_db),
):
    return GameStateService.get_game_state(
        db=db,
        room_code=room_code,
    )
    
@router.get(
    "/{room_code}/rounds",
    response_model=RoundHistoryResponse,
    status_code=status.HTTP_200_OK,
)
def get_round_history(
    room_code: str,
    db: Session = Depends(get_db),
):
    return RoundHistoryService.get_round_history(
        db=db,
        room_code=room_code,
    )
    
@router.get(
    "/{room_code}/rounds/{round_id}/guesses",
    response_model=GuessHistoryResponse,
    status_code=status.HTTP_200_OK,
)
def get_guess_history(
    room_code: str,
    round_id: int,
    db: Session = Depends(get_db),
    ):
    return GuessHistoryService.get_guess_history(
    db=db,
    room_code=room_code,
    round_id=round_id,
    )

@router.get(
    "/{room_code}/results",
    response_model=GameResultsResponse,
    status_code=status.HTTP_200_OK,
)
def get_game_results(
    room_code: str,
    db: Session = Depends(get_db),
    ):
    return GameResultsService.get_game_results(
    db=db,
    room_code=room_code,
    )
