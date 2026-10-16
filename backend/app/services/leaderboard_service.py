from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.room_repository import RoomRepository
from app.repositories.leaderboard_repository import LeaderboardRepository
from app.schemas.leaderboard import (
    LeaderboardPlayerResponse,
    LeaderboardResponse,
)


class LeaderboardService:

    @staticmethod
    def get_leaderboard(
        db: Session,
        room_code: str,
    ) -> LeaderboardResponse:
        # Find the room
        room = RoomRepository.get_by_code(db, room_code)

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        # Get players ordered by score, highest first
        players = LeaderboardRepository.get_players_by_room(
            db=db,
            room_id=room.id,
        )

        # Build the leaderboard with competition ranking:
        # Scores 100, 80, 80, 50 receive ranks 1, 2, 2, 4.
        leaderboard = []
        previous_score = None
        current_rank = 0

        for position, player in enumerate(players, start=1):
            if player.score != previous_score:
                current_rank = position
                previous_score = player.score

            leaderboard.append(
                LeaderboardPlayerResponse(
                    rank=current_rank,
                    player_id=player.id,
                    display_name=player.display_name,
                    score=player.score,
                )
            )

        return LeaderboardResponse(
            room_code=room.room_code,
            total_players=len(players),
            leaderboard=leaderboard,
        )