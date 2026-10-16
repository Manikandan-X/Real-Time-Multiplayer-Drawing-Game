from datetime import datetime

from pydantic import BaseModel, ConfigDict

class RoundHistoryItemResponse(BaseModel):
    id: int
    round_number: int
    drawer_id: int | None
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime


    model_config = ConfigDict(from_attributes=True)


class RoundHistoryResponse(BaseModel):
    room_code: str
    total_rounds: int
    rounds: list[RoundHistoryItemResponse]
