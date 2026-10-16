from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.player import Player
    from app.models.game_round import GameRound

class GameRoom(Base):
    __tablename__ = "game_rooms"


    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    room_code: Mapped[str] = mapped_column(
        String(8),
        unique=True,
        index=True,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        default="WAITING",
        nullable=False,
    )

    max_players: Mapped[int] = mapped_column(
        Integer,
        default=8,
        nullable=False,
    )

    total_rounds: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
    )

    current_round: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    players: Mapped[list["Player"]] = relationship(
        "Player",
        back_populates="room",
        cascade="all, delete-orphan",
    )

    rounds: Mapped[list["GameRound"]] = relationship(
        "GameRound",
        back_populates="room",
        cascade="all, delete-orphan",
    )

