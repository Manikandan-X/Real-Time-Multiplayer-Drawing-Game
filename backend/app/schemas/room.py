from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoomCreateRequest(BaseModel):
    max_players: int = Field(default=8, ge=2, le=8)
    total_rounds: int = Field(default=3, ge=1, le=10)


class RoomResponse(BaseModel):
    id: int
    room_code: str
    status: str
    max_players: int
    total_rounds: int
    current_round: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
    

class RoomListItemResponse(BaseModel):
    room_code: str
    status: str
    current_players: int
    max_players: int
    total_rounds: int


class RoomListResponse(BaseModel):
    total_rooms: int
    rooms: list[RoomListItemResponse]
    

class GameStartResponse(BaseModel):
    room_code: str
    status: str
    current_round: int
    total_rounds: int
    round_id: int
    drawer_id: int

