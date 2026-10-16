from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.game_room import GameRoom
    from app.models.player import Player
    from app.models.guess import Guess

class GameRound(Base):
    __tablename__ = "game_rounds"


    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    room_id: Mapped[int] = mapped_column(
        ForeignKey("game_rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    round_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    drawer_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    secret_word: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="PENDING",
        nullable=False,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    room: Mapped["GameRoom"] = relationship(
        "GameRoom",
        back_populates="rounds",
    )

    drawer: Mapped["Player | None"] = relationship(
        "Player",
        back_populates="drawn_rounds",
    )

    guesses: Mapped[list["Guess"]] = relationship(
        "Guess",
        back_populates="game_round",
        cascade="all, delete-orphan",
    )
