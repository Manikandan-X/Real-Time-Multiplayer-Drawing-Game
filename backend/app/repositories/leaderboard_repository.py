from sqlalchemy.orm import Session

from app.models.player import Player


class LeaderboardRepository:

    @staticmethod
    def get_players_by_room(db: Session, room_id: int) -> list[Player]:
        return (
            db.query(Player)
            .filter(Player.room_id == room_id)
            .order_by(Player.score.desc(), Player.id.asc())
            .all()
        )