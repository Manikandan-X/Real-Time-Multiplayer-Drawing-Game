from pydantic import BaseModel

from app.schemas.leaderboard import LeaderboardPlayerResponse

class GameResultsResponse(BaseModel):
    room_code: str
    game_status: str
    total_rounds: int
    completed_rounds: int
    total_players: int
    leaderboard: list[LeaderboardPlayerResponse]
