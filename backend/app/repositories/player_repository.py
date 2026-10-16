from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.player import Player

class PlayerRepository:

    @staticmethod
    def create(
        db: Session,
        room_id: int,
        display_name: str,
        session_token: str,
    ) -> Player:
        player = Player(
            room_id=room_id,
            display_name=display_name,
            session_token=session_token,
        )

        db.add(player)
        db.flush()
        db.refresh(player)

        return player

    @staticmethod
    def get_by_id(
        db: Session,
        player_id: int,
    ) -> Player | None:
        statement = select(Player).where(
            Player.id == player_id
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_session_token(
        db: Session,
        session_token: str,
    ) -> Player | None:
        statement = select(Player).where(
            Player.session_token == session_token
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_display_name(
        db: Session,
        room_id: int,
        display_name: str,
    ) -> Player | None:
        statement = select(Player).where(
            Player.room_id == room_id,
            func.lower(Player.display_name) == display_name.lower(),
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_room(
        db: Session,
        room_id: int,
    ) -> list[Player]:
        statement = (
            select(Player)
            .where(Player.room_id == room_id)
            .order_by(Player.joined_at, Player.id)
        )

        return list(db.scalars(statement).all())

    @staticmethod
    def count_by_room(
        db: Session,
        room_id: int,
    ) -> int:
        statement = (
            select(func.count())
            .select_from(Player)
            .where(Player.room_id == room_id)
        )

        return db.scalar(statement) or 0

    @staticmethod
    def delete(
        db: Session,
        player: Player,
    ) -> None:
        db.delete(player)
        db.flush()
