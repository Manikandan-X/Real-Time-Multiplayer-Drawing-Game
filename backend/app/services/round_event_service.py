from collections import defaultdict

from sqlalchemy import select

from app.core.constants import ROUND_STATUS_COMPLETED
from app.db.session import SessionLocal
from app.models.game_round import GameRound
from app.models.guess import Guess
from app.models.player import Player
from app.services.connection_manager import manager


async def broadcast_round_ended(room_code: str, round_id: int) -> None:
    """
    Tell every player that a round has finished and reveal its word.

    The word is only included once the round is COMPLETED, so this can
    never leak the word of a round that is still being played.
    """

    db = SessionLocal()

    try:
        game_round = db.get(GameRound, round_id)

        if (
            game_round is None
            or game_round.status != ROUND_STATUS_COMPLETED
        ):
            return

        guesses = db.execute(
            select(Guess).where(Guess.round_id == round_id)
        ).scalars().all()

        round_points: dict[int, int] = defaultdict(int)

        for guess in guesses:
            round_points[guess.player_id] += guess.points_awarded

        players = db.execute(
            select(Player)
            .where(Player.room_id == game_round.room_id)
            .order_by(Player.score.desc(), Player.id.asc())
        ).scalars().all()

        message = {
            "type": "round_ended",
            "round_id": game_round.id,
            "round_number": game_round.round_number,
            "drawer_id": game_round.drawer_id,
            "word": game_round.secret_word,
            "scores": [
                {
                    "player_id": player.id,
                    "display_name": player.display_name,
                    "score": player.score,
                    "round_points": round_points.get(player.id, 0),
                }
                for player in players
            ],
        }

    finally:
        db.close()

    await manager.broadcast(room_code, message)
