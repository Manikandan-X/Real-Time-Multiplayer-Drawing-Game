from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guess import Guess

class GuessRepository:
    
    @staticmethod
    def create(
        db: Session,
        round_id: int,
        player_id: int,
        guess_text: str,
        is_correct: bool = False,
        points_awarded: int = 0,
    ) -> Guess:
        guess = Guess(
            round_id=round_id,
            player_id=player_id,
            guess_text=guess_text,
            is_correct=is_correct,
            points_awarded=points_awarded,
        )

        db.add(guess)
        db.flush()
        db.refresh(guess)

        return guess

    @staticmethod
    def get_by_id(
        db: Session,
        guess_id: int,
    ) -> Guess | None:
        statement = select(Guess).where(
            Guess.id == guess_id
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_round(
        db: Session,
        round_id: int,
    ) -> list[Guess]:
        statement = (
            select(Guess)
            .where(Guess.round_id == round_id)
            .order_by(Guess.guessed_at, Guess.id)
        )

        return list(db.scalars(statement).all())

    @staticmethod
    def get_by_player_and_round(
        db: Session,
        player_id: int,
        round_id: int,
    ) -> list[Guess]:
        statement = (
            select(Guess)
            .where(
                Guess.player_id == player_id,
                Guess.round_id == round_id,
            )
            .order_by(Guess.guessed_at, Guess.id)
        )

        return list(db.scalars(statement).all())