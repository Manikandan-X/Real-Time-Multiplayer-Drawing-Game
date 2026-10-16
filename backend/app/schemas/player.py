from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class PlayerJoinRequest(BaseModel):
    display_name: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True,
            min_length=2,
            max_length=50,
        ),
    ]


class PlayerReadyRequest(BaseModel):
    is_ready: bool


class PlayerResponse(BaseModel):
    id: int
    room_id: int
    display_name: str
    is_ready: bool
    is_connected: bool
    score: int
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomPlayerListResponse(BaseModel):
    room_code: str
    total_players: int
    players: list[PlayerResponse]


class PlayerJoinResponse(PlayerResponse):
    session_token: str
