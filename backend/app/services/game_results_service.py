from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.constants import ROOM_STATUS_COMPLETED
from app.repositories.game_round_repository import GameRoundRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.game_results import GameResultsResponse
from app.services.leaderboard_service import LeaderboardService

class GameResultsService:


    @staticmethod
    def get_game_results(
        db: Session,
        room_code: str,
    ) -> GameResultsResponse:
        normalized_room_code = room_code.strip().upper()

        room = RoomRepository.get_by_code(
            db=db,
            room_code=normalized_room_code,
        )

        if room is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found.",
            )

        if room.status != ROOM_STATUS_COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Final results are available only after the game is completed.",
            )

        rounds = GameRoundRepository.get_by_room(
            db=db,
            room_id=room.id,
        )

        completed_rounds = sum(
            1 for game_round in rounds
            if game_round.status == "COMPLETED"
        )

        leaderboard = LeaderboardService.get_leaderboard(
            db=db,
            room_code=room.room_code,
        )

        return GameResultsResponse(
            room_code=room.room_code,
            game_status=room.status,
            total_rounds=room.total_rounds,
            completed_rounds=completed_rounds,
            total_players=leaderboard.total_players,
            leaderboard=leaderboard.leaderboard,
        )
