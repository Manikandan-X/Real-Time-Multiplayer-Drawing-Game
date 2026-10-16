from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import (
POINTS_CORRECT_GUESS,
ROOM_STATUS_IN_PROGRESS,
ROUND_STATUS_IN_PROGRESS,
)
from app.repositories.game_round_repository import GameRoundRepository
from app.repositories.guess_repository import GuessRepository
from app.repositories.player_repository import PlayerRepository
from app.repositories.room_repository import RoomRepository

class GuessService:

    @staticmethod
    def submit_guess(
        db: Session,
        room_code: str,
        round_id: int,
        session_token: str,
        guess_text: str,
    ):
        normalized_room_code = room_code.strip().upper()
        normalized_guess = guess_text.strip()

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

        # 2. Verify that the game is in progress.
        if room.status != ROOM_STATUS_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Guesses can only be submitted during an active game.",
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

        # 5. Verify that the round exists.
        game_round = GameRoundRepository.get_by_id(
            db,
            round_id,
        )

        if game_round is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Game round not found.",
            )

        # 6. Verify that the round belongs to this room.
        if game_round.room_id != room.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This round does not belong to the specified room.",
            )

        # 7. Only accept guesses during an active round.
        if game_round.status != ROUND_STATUS_IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Guesses can only be submitted during an active round.",
            )

        # 8. The drawer cannot submit guesses for their own round.
        if game_round.drawer_id == player.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The drawer cannot submit guesses during their round.",
            )

        # 9. Validate the submitted text.
        if not normalized_guess:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Guess cannot be empty.",
            )

        # 10. Check the guess without revealing the secret word.
        is_correct = (
            normalized_guess.casefold()
            == game_round.secret_word.strip().casefold()
        )

        try:
            points_awarded = 0

            # 11. Award points only for the player's first correct guess
            # in this round.
            if is_correct:
                previous_guesses = GuessRepository.get_by_player_and_round(
                    db=db,
                    player_id=player.id,
                    round_id=game_round.id,
                )

                already_guessed_correctly = any(
                    previous_guess.is_correct
                    for previous_guess in previous_guesses
                )

                if not already_guessed_correctly:
                    points_awarded = POINTS_CORRECT_GUESS
                    player.score += points_awarded

            # 12. Save the guess and score in the same transaction.
            guess = GuessRepository.create(
                db=db,
                round_id=game_round.id,
                player_id=player.id,
                guess_text=normalized_guess,
                is_correct=is_correct,
                points_awarded=points_awarded,
            )

            db.commit()
            db.refresh(guess)

            return guess

        except Exception:
            db.rollback()
            raise
