from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.game_room import GameRoom
    from app.models.guess import Guess
    from app.models.game_round import GameRound

class Player(Base):
    __tablename__ = "players"


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

    display_name: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    session_token: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    is_ready: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    is_connected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    score: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    room: Mapped["GameRoom"] = relationship(
        "GameRoom",
        back_populates="players",
    )

    guesses: Mapped[list["Guess"]] = relationship(
        "Guess",
        back_populates="player",
        cascade="all, delete-orphan",
    )

    drawn_rounds: Mapped[list["GameRound"]] = relationship(
        "GameRound",
        back_populates="drawer",
    )
