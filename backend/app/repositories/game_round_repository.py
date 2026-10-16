from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.game_round import GameRound


class GameRoundRepository:

    @staticmethod
    def create(
        db: Session,
        room_id: int,
        round_number: int,
        drawer_id: int,
        secret_word: str,
        status: str = "PENDING",
    ) -> GameRound:
        game_round = GameRound(
            room_id=room_id,
            round_number=round_number,
            drawer_id=drawer_id,
            secret_word=secret_word,
            status=status,
        )

        db.add(game_round)
        db.flush()
        db.refresh(game_round)

        return game_round

    @staticmethod
    def get_by_id(
        db: Session,
        round_id: int,
    ) -> GameRound | None:
        statement = select(GameRound).where(
            GameRound.id == round_id
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_room_and_number(
        db: Session,
        room_id: int,
        round_number: int,
    ) -> GameRound | None:
        statement = select(GameRound).where(
            GameRound.room_id == room_id,
            GameRound.round_number == round_number,
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_room(
        db: Session,
        room_id: int,
    ) -> list[GameRound]:
        statement = (
            select(GameRound)
            .where(GameRound.room_id == room_id)
            .order_by(GameRound.round_number)
        )

        return list(db.scalars(statement).all())