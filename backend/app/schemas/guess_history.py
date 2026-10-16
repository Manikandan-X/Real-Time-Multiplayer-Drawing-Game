from datetime import datetime

from pydantic import BaseModel, ConfigDict

class GuessHistoryItemResponse(BaseModel):
    id: int
    round_id: int
    player_id: int
    guess_text: str
    is_correct: bool
    points_awarded: int
    guessed_at: datetime


    model_config = ConfigDict(from_attributes=True)


class GuessHistoryResponse(BaseModel):
    room_code: str
    round_id: int
    total_guesses: int
    guesses: list[GuessHistoryItemResponse]
