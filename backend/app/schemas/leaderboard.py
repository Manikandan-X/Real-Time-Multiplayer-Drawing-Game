from pydantic import BaseModel, ConfigDict


class LeaderboardPlayerResponse(BaseModel):
    rank: int
    player_id: int
    display_name: str
    score: int

    model_config = ConfigDict(from_attributes=True)


class LeaderboardResponse(BaseModel):
    room_code: str
    total_players: int
    leaderboard: list[LeaderboardPlayerResponse]