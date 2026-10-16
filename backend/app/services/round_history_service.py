from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.game_round_repository import GameRoundRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.round_history import (
RoundHistoryItemResponse,
RoundHistoryResponse,
)

class RoundHistoryService:


    @staticmethod
    def get_round_history(
        db: Session,
        room_code: str,
    ) -> RoundHistoryResponse:
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

        rounds = GameRoundRepository.get_by_room(
            db=db,
            room_id=room.id,
        )

        return RoundHistoryResponse(
            room_code=room.room_code,
            total_rounds=len(rounds),
            rounds=[
                RoundHistoryItemResponse.model_validate(game_round)
                for game_round in rounds
            ],
        )
