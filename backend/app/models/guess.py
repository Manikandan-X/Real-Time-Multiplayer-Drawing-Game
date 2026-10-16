from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.game_round import GameRound
    from app.models.player import Player

class Guess(Base):
    __tablename__ = "guesses"


    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    round_id: Mapped[int] = mapped_column(
        ForeignKey("game_rounds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    guess_text: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    points_awarded: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    guessed_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    game_round: Mapped["GameRound"] = relationship(
        "GameRound",
        back_populates="guesses",
    )

    player: Mapped["Player"] = relationship(
        "Player",
        back_populates="guesses",
    )
