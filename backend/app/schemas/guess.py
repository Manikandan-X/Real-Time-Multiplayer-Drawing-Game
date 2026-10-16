from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

class GuessSubmitRequest(BaseModel):
    guess_text: Annotated[
    str,
    StringConstraints(
    strip_whitespace=True,
    min_length=1,
    max_length=100,
    ),
    ]

class GuessResponse(BaseModel):
    id: int
    round_id: int
    player_id: int
    guess_text: str
    is_correct: bool
    points_awarded: int
    guessed_at: datetime

    model_config = ConfigDict(from_attributes=True)
