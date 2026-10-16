from datetime import datetime
import secrets
import string

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import (
    MAX_PLAYERS_PER_ROOM,
    MIN_PLAYERS_PER_ROOM,
    ROOM_CODE_LENGTH,
    ROUND_DURATION_SECONDS,
    ROOM_STATUS_WAITING,
    ROOM_STATUS_IN_PROGRESS,
    ROOM_STATUS_COMPLETED,
    ROUND_STATUS_IN_PROGRESS,
    ROUND_STATUS_COMPLETED,
)
from app.models.game_room import GameRoom
from app.models.game_round import GameRound
from app.models.player import Player
from app.repositories.player_repository import PlayerRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.game_round_repository import GameRoundRepository
from app.schemas.room import RoomListItemResponse, RoomListResponse

SECRET_WORDS = [
    "APPLE",
    "BANANA",
    "ELEPHANT",
    "GUITAR",
    "RAINBOW",
    "MOUNTAIN",
    "BICYCLE",
    "BUTTERFLY",
    "AIRPLANE",
    "PIZZA",
    "CASTLE",
    "ROCKET",
    "TURTLE",
    "UMBRELLA",
    "SUNFLOWER",
]

class RoomService:

    @staticmethod
    def create_room(
        db: Session,
        max_players: int,
        total_rounds: int,
    ) -> GameRoom:
        if not MIN_PLAYERS_PER_ROOM <= max_players <= MAX_PLAYERS_PER_ROOM:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"max_players must be between "
                    f"{MIN_PLAYERS_PER_ROOM} and {MAX_PLAYERS_PER_ROOM}."
                ),
            )

        room_code_characters = string.ascii_uppercase + string.digits

        try:
            for _ in range(5):
                room_code = "".join(
                    secrets.choice(room_code_characters)
                    for _ in range(ROOM_CODE_LENGTH)
                )

                if RoomRepository.get_by_code(db, room_code) is None:
                    room = RoomRepository.create(
                        db=db,
                        max_players=max_players,
                        total_rounds=total_rounds,
                        room_code=room_code,
                    )

                    db.commit()
                    db.refresh(room)

                    return room

            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to generate a unique room code. Please try again.",
            )

        except IntegrityError as exc:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to create the room. Please try again.",
            ) from exc

        except Exception:
            db.rollback()
            raise

    @staticmethod
    def join_room(
        db: Session,
        room_code: str,
        display_name: str,
    ) -> Player:
        normalized_room_code = room_code.strip().upper()
        normalized_display_name = display_name.strip()

        if not normalized_display_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Display name cannot be empty.",
            )

        room = RoomRepository.get_by_code(
            db,
            normalized_room_code,
        )

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        if room.status != ROOM_STATUS_WAITING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This room is no longer accepting players.",
            )

        existing_player = PlayerRepository.get_by_display_name(
            db=db,
            room_id=room.id,
            display_name=normalized_display_name,
        )

        if existing_player is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This display name is already used in the room.",
            )

        player_count = PlayerRepository.count_by_room(
            db,
            room.id,
        )

        if player_count >= room.max_players:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This room is full.",
            )

        session_token = secrets.token_urlsafe(32)

        try:
            player = PlayerRepository.create(
                db=db,
                room_id=room.id,
                display_name=normalized_display_name,
                session_token=session_token,
            )

            db.commit()
            db.refresh(player)

            return player

        except IntegrityError as exc:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Unable to join the room. "
                    "The display name or session token may already exist."
                ),
            ) from exc

        except Exception:
            db.rollback()
            raise
        
    
    @staticmethod
    def set_player_ready(
        db: Session,
        room_code: str,
        session_token: str,
        is_ready: bool,
    ) -> Player:
        normalized_room_code = room_code.strip().upper()

        # Find the room.
        room = RoomRepository.get_by_code(db, normalized_room_code)

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        # Readiness can only be changed before the game starts.
        if room.status != ROOM_STATUS_WAITING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Player readiness cannot be changed after the game starts.",
            )

        # Validate the player's session token.
        player = PlayerRepository.get_by_session_token(
            db=db,
            session_token=session_token,
        )

        if player is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid player session token.",
            )

        # Confirm that the player belongs to this room.
        if player.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This player does not belong to the specified room.",
            )

        # Update and save the readiness status.
        try:
            player.is_ready = is_ready

            db.commit()
            db.refresh(player)

            return player

        except Exception:
            db.rollback()
            raise
        
    
    @staticmethod
    def leave_room(
        db: Session,
        room_code: str,
        session_token: str,
    ) -> dict:
        normalized_room_code = room_code.strip().upper()

        # 1. Verify that the room exists.
        room = RoomRepository.get_by_code(
            db,
            normalized_room_code,
        )

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        # 2. Allow leaving only before the game starts.
        if room.status != ROOM_STATUS_WAITING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Players can leave only while the room is waiting.",
            )

        # 3. Validate the player's session token.
        player = PlayerRepository.get_by_session_token(
            db=db,
            session_token=session_token,
        )

        if player is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid player session token.",
            )

        # 4. Verify that the player belongs to this room.
        if player.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This player does not belong to the specified room.",
            )

        # 5. Remove the player from the room.
        try:
            player_name = player.display_name

            PlayerRepository.delete(
                db=db,
                player=player,
            )

            db.commit()

            return {
                "message": "You have left the room successfully.",
                "room_code": room.room_code,
                "player_name": player_name,
            }

        except Exception:
            db.rollback()
            raise



    @staticmethod
    def get_room(
        db: Session,
        room_code: str,
    ) -> GameRoom:
        room = RoomRepository.get_by_code(
            db,
            room_code.strip().upper(),
        )

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        return room

    @staticmethod
    def get_room_players(
        db: Session,
        room_code: str,
    ) -> tuple[GameRoom, list[Player]]:
        room = RoomService.get_room(
            db,
            room_code,
        )

        players = PlayerRepository.get_by_room(
            db,
            room.id,
        )

        return room, players
    
    
    @staticmethod
    def get_all_rooms(db: Session) -> RoomListResponse:
        rooms = RoomRepository.get_all(db)

        room_items = []

        for room in rooms:
            player_count = PlayerRepository.count_by_room(
                db=db,
                room_id=room.id,
            )

            room_items.append(
                RoomListItemResponse(
                    room_code=room.room_code,
                    status=room.status,
                    current_players=player_count,
                    max_players=room.max_players,
                    total_rounds=room.total_rounds,
                )
            )

        return RoomListResponse(
            total_rooms=len(room_items),
            rooms=room_items,
        )
        
    
    @staticmethod
    def start_game(
        db: Session,
        room_code: str,
        session_token: str,
    ) -> dict:
        normalized_room_code = room_code.strip().upper()

        # 1. Verify that the room exists.
        room = RoomRepository.get_by_code(
            db=db,
            room_code=normalized_room_code,
        )

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        # 2. Validate the player's session token.
        player = PlayerRepository.get_by_session_token(
            db=db,
            session_token=session_token,
        )

        if player is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid player session token.",
            )

        # 3. Verify that the player belongs to this room.
        if player.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This player does not belong to the specified room.",
            )

        # 4. The room must still be waiting.
        if room.status != ROOM_STATUS_WAITING:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This game has already started or is no longer available.",
            )

        # 5. Retrieve all players in the room.
        players = PlayerRepository.get_by_room(
            db=db,
            room_id=room.id,
        )

        # 6. Require at least two players.
        if len(players) < 2:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="At least two players are required to start the game.",
            )

        # 7. Every player must be ready.
        if any(not room_player.is_ready for room_player in players):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="All players must be ready before the game can start.",
            )

        # 8. Choose a drawer and secret word.
        drawer = secrets.choice(players)
        secret_word = secrets.choice(SECRET_WORDS)

        try:
            # 9. Update the room status.
            room.status = ROOM_STATUS_IN_PROGRESS
            room.current_round = 1

            # 10. Create the first round.
            game_round = GameRoundRepository.create(
                db=db,
                room_id=room.id,
                round_number=1,
                drawer_id=drawer.id,
                secret_word=secret_word,
                status=ROUND_STATUS_IN_PROGRESS,
            )

            game_round.started_at = datetime.now()

            # 11. Save both changes in one transaction.
            db.commit()
            db.refresh(room)
            db.refresh(game_round)

            # Never return the secret word in this public response.
            return {
                "room_code": room.room_code,
                "status": room.status,
                "current_round": room.current_round,
                "total_rounds": room.total_rounds,
                "round_id": game_round.id,
                "drawer_id": drawer.id,
            }

        except Exception:
            db.rollback()
            raise

    
    @staticmethod
    def finish_round(
        db: Session,
        room_code: str,
        round_id: int,
        session_token: str,
    ) -> dict:
        normalized_room_code = room_code.strip().upper()

        room = RoomRepository.get_by_code(
            db=db,
            room_code=normalized_room_code,
        )
        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        if room.status != ROOM_STATUS_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This game is not currently in progress.",
            )

        player = PlayerRepository.get_by_session_token(
            db=db,
            session_token=session_token,
        )
        if player is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid player session token.",
            )

        if player.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This player does not belong to the specified room.",
            )

        game_round = GameRoundRepository.get_by_id(
            db=db,
            round_id=round_id,
        )
        if game_round is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game round not found.",
            )

        if game_round.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This round does not belong to the specified room.",
            )

        if game_round.drawer_id != player.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the current drawer can finish the round.",
            )

        return RoomService._complete_round_transition(
            db=db,
            room=room,
            game_round=game_round,
        )

    @staticmethod
    def finish_round_automatically(
        db: Session,
        room_code: str,
        round_id: int,
    ) -> dict:
        """
        Internal server-side completion used by the round timer.

        This method must not be exposed as an unauthenticated HTTP endpoint.
        """
        normalized_room_code = room_code.strip().upper()

        room = RoomRepository.get_by_code(
            db=db,
            room_code=normalized_room_code,
        )
        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        if room.status != ROOM_STATUS_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This game is not currently in progress.",
            )

        game_round = GameRoundRepository.get_by_id(
            db=db,
            round_id=round_id,
        )
        if game_round is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game round not found.",
            )

        if game_round.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This round does not belong to the specified room.",
            )

        if game_round.round_number != room.current_round:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This is not the current round.",
            )

        if game_round.status != ROUND_STATUS_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This round has already finished.",
            )

        if game_round.started_at is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The round has no start timestamp.",
            )

        elapsed_seconds = (
            datetime.now() - game_round.started_at
        ).total_seconds()

        if elapsed_seconds < ROUND_DURATION_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The round timer has not expired.",
            )

        return RoomService._complete_round_transition(
            db=db,
            room=room,
            game_round=game_round,
        )

    @staticmethod
    def _complete_round_transition(
        db: Session,
        room: GameRoom,
        game_round: GameRound,
    ) -> dict:
        """
        Shared transition logic for manual and automatic round completion.
        """
        try:
            game_round.status = ROUND_STATUS_COMPLETED
            game_round.ended_at = datetime.now()

            if room.current_round >= room.total_rounds:
                room.status = ROOM_STATUS_COMPLETED

                db.commit()
                db.refresh(room)
                db.refresh(game_round)

                return {
                    "message": "The game has been completed.",
                    "room_code": room.room_code,
                    "status": room.status,
                    "completed_round_id": game_round.id,
                    "current_round": room.current_round,
                    "total_rounds": room.total_rounds,
                    "next_round_id": None,
                    "next_drawer_id": None,
                }

            players = sorted(
                PlayerRepository.get_by_room(
                    db=db,
                    room_id=room.id,
                ),
                key=lambda room_player: room_player.id,
            )

            if len(players) < MIN_PLAYERS_PER_ROOM:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        "At least two players are required "
                        "to continue the game."
                    ),
                )

            current_drawer_index = next(
                (
                    index
                    for index, room_player in enumerate(players)
                    if room_player.id == game_round.drawer_id
                ),
                None,
            )

            if current_drawer_index is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="The current drawer is no longer available.",
                )

            next_drawer_index = (
                current_drawer_index + 1
            ) % len(players)

            next_drawer = players[next_drawer_index]
            secret_word = secrets.choice(SECRET_WORDS)
            next_round_number = room.current_round + 1

            next_round = GameRoundRepository.create(
                db=db,
                room_id=room.id,
                round_number=next_round_number,
                drawer_id=next_drawer.id,
                secret_word=secret_word,
                status=ROUND_STATUS_IN_PROGRESS,
            )

            next_round.started_at = datetime.now()
            room.current_round = next_round_number

            db.commit()
            db.refresh(room)
            db.refresh(game_round)
            db.refresh(next_round)

            return {
                "message": (
                    "The current round has finished "
                    "and the next round has started."
                ),
                "room_code": room.room_code,
                "status": room.status,
                "completed_round_id": game_round.id,
                "current_round": room.current_round,
                "total_rounds": room.total_rounds,
                "next_round_id": next_round.id,
                "next_drawer_id": next_drawer.id,
            }

        except Exception:
            db.rollback()
            raise


