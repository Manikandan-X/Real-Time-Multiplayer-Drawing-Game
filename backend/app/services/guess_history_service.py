from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import ROUND_STATUS_COMPLETED

from app.repositories.game_round_repository import GameRoundRepository
from app.repositories.guess_repository import GuessRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.guess_history import (
GuessHistoryItemResponse,
GuessHistoryResponse,
)

class GuessHistoryService:


    @staticmethod
    def get_guess_history(
        db: Session,
        room_code: str,
        round_id: int,
    ) -> GuessHistoryResponse:
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game round not found in this room.",
            )

        guesses = GuessRepository.get_by_round(
            db=db,
            round_id=game_round.id,
        )

        # A correct guess is the secret word itself, so its text must not
        # be readable by other players until the round has finished.
        round_finished = game_round.status == ROUND_STATUS_COMPLETED

        items = []

        for guess in guesses:
            item = GuessHistoryItemResponse.model_validate(guess)

            if guess.is_correct and not round_finished:
                item.guess_text = "***"

            items.append(item)

        return GuessHistoryResponse(
            room_code=room.room_code,
            round_id=game_round.id,
            total_guesses=len(guesses),
            guesses=items,
        )
