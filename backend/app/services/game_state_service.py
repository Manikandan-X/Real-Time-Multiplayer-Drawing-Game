from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.game_room import GameRoom
from app.models.game_round import GameRound
from app.models.player import Player
from app.repositories.room_repository import RoomRepository
from app.schemas.game_state import (
    GameRoundStateResponse,
    GameStateResponse,
)
from app.schemas.player import PlayerResponse


class GameStateService:

    @staticmethod
    def get_game_state(
        db: Session,
        room_code: str,
    ) -> GameStateResponse:
        # Find the requested room.
        room = RoomRepository.get_by_code(
            db=db,
            room_code=room_code.strip().upper(),
        )

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        # Retrieve players in a consistent order.
        players = db.execute(
            select(Player)
            .where(Player.room_id == room.id)
            .order_by(Player.id.asc())
        ).scalars().all()

        # Retrieve the current round, if one exists.
        current_round = None

        if room.current_round > 0:
            current_round = db.execute(
                select(GameRound).where(
                    GameRound.room_id == room.id,
                    GameRound.round_number == room.current_round,
                )
            ).scalar_one_or_none()

        round_state = None

        if current_round is not None:
            round_state = GameRoundStateResponse(
                id=current_round.id,
                round_number=current_round.round_number,
                drawer_id=current_round.drawer_id,
                status=current_round.status,
                started_at=current_round.started_at,
                ended_at=current_round.ended_at,
            )

        return GameStateResponse(
            room_code=room.room_code,
            room_status=room.status,
            current_round=room.current_round,
            total_rounds=room.total_rounds,
            max_players=room.max_players,
            total_players=len(players),
            players=[
                PlayerResponse.model_validate(player)
                for player in players
            ],
            current_round_state=round_state,
        )