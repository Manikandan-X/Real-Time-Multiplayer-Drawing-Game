from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.player import PlayerResponse


class GameRoundStateResponse(BaseModel):
    id: int
    round_number: int
    drawer_id: int | None
    status: str
    started_at: datetime | None
    ended_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class GameStateResponse(BaseModel):
    room_code: str
    room_status: str
    current_round: int
    total_rounds: int
    max_players: int
    total_players: int
    players: list[PlayerResponse]
    current_round_state: GameRoundStateResponse | None