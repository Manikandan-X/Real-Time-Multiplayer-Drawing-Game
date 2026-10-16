from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.game_room import GameRoom


class RoomRepository:

    @staticmethod
    def create(
        db: Session,
        max_players: int,
        total_rounds: int,
        room_code: str,
    ) -> GameRoom:
        room = GameRoom(
            room_code=room_code,
            max_players=max_players,
            total_rounds=total_rounds,
        )

        db.add(room)
        db.flush()
        db.refresh(room)

        return room

    @staticmethod
    def get_by_code(
        db: Session,
        room_code: str,
    ) -> GameRoom | None:
        statement = select(GameRoom).where(
            GameRoom.room_code == room_code
        )

        return db.scalar(statement)

    @staticmethod
    def get_by_id(
        db: Session,
        room_id: int,
    ) -> GameRoom | None:
        statement = select(GameRoom).where(
            GameRoom.id == room_id
        )

        return db.scalar(statement)

    @staticmethod
    def get_all(
        db: Session,
    ) -> list[GameRoom]:
        statement = (
            select(GameRoom)
            .order_by(GameRoom.created_at.desc(), GameRoom.id.desc())
        )

        return list(db.scalars(statement).all())
