import math
import re

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import (
    ROOM_STATUS_IN_PROGRESS,
    ROUND_STATUS_IN_PROGRESS,
)
from app.db.session import SessionLocal
from app.models.game_room import GameRoom
from app.models.game_round import GameRound
from app.models.player import Player
from app.repositories.player_repository import PlayerRepository
from app.repositories.room_repository import RoomRepository
from app.services.connection_manager import manager
from app.services.round_timer_service import round_timer_service


router = APIRouter(tags=["WebSocket"])

COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")

MAX_POINTS_PER_MESSAGE = 200
MIN_LINE_WIDTH = 1
MAX_LINE_WIDTH = 50


def validate_drawing_message(
    message: object,
) -> tuple[dict | None, str | None]:
    """Validate drawing events before broadcasting them."""

    if not isinstance(message, dict):
        return None, "Message must be a JSON object."

    event_type = message.get("type")

    if event_type == "clear_canvas":
        return {"type": "clear_canvas"}, None

    if event_type != "draw":
        return None, (
            "Unsupported event type. Use 'draw' or 'clear_canvas'."
        )

    points = message.get("points")

    if not isinstance(points, list) or not points:
        return None, (
            "The draw event must contain a non-empty points list."
        )

    if len(points) > MAX_POINTS_PER_MESSAGE:
        return None, (
            f"A maximum of {MAX_POINTS_PER_MESSAGE} points "
            "is allowed per message."
        )

    validated_points = []

    for point in points:
        if not isinstance(point, dict):
            return None, "Each point must be a JSON object."

        x = point.get("x")
        y = point.get("y")

        if (
            isinstance(x, bool)
            or not isinstance(x, (int, float))
            or isinstance(y, bool)
            or not isinstance(y, (int, float))
        ):
            return None, (
                "Each point must contain numeric x and y coordinates."
            )

        x = float(x)
        y = float(y)

        if not math.isfinite(x) or not math.isfinite(y):
            return None, "Point coordinates must be finite numbers."

        if not (0 <= x <= 1 and 0 <= y <= 1):
            return None, "Point coordinates must be between 0 and 1."

        validated_points.append({"x": x, "y": y})

    color = message.get("color", "#000000")

    if (
        not isinstance(color, str)
        or not COLOR_PATTERN.fullmatch(color)
    ):
        return None, (
            "Color must be a hexadecimal color such as #000000."
        )

    line_width = message.get("line_width", 4)

    if (
        isinstance(line_width, bool)
        or not isinstance(line_width, (int, float))
        or not math.isfinite(line_width)
        or not MIN_LINE_WIDTH <= line_width <= MAX_LINE_WIDTH
    ):
        return None, (
            f"Line width must be between "
            f"{MIN_LINE_WIDTH} and {MAX_LINE_WIDTH}."
        )

    return {
        "type": "draw",
        "points": validated_points,
        "color": color,
        "line_width": line_width,
    }, None


def update_player_connection_status(
    player_id: int,
    is_connected: bool,
) -> None:
    """Persist a player's WebSocket connection status."""

    db: Session = SessionLocal()

    try:
        player = db.execute(
            select(Player).where(Player.id == player_id)
        ).scalar_one_or_none()

        if player is not None:
            player.is_connected = is_connected
            db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


async def send_secret_word_if_drawer(
    websocket: WebSocket,
    room_id: int,
    player_id: int,
) -> None:
    """
    Send the active round's secret word only to its assigned drawer.

    This message is sent directly to one WebSocket connection.
    It is never broadcast to the room.
    """

    db: Session = SessionLocal()

    try:
        current_room = db.execute(
            select(GameRoom).where(
                GameRoom.id == room_id
            )
        ).scalar_one_or_none()

        if (
            current_room is None
            or current_room.status != ROOM_STATUS_IN_PROGRESS
        ):
            return

        current_round = db.execute(
            select(GameRound).where(
                GameRound.room_id == current_room.id,
                GameRound.round_number == current_room.current_round,
            )
        ).scalar_one_or_none()

        if (
            current_round is None
            or current_round.status != ROUND_STATUS_IN_PROGRESS
            or current_round.drawer_id != player_id
            or not current_round.secret_word
        ):
            return

        secret_word_message = {
            "type": "secret_word",
            "round_id": current_round.id,
            "round_number": current_round.round_number,
            "word": current_round.secret_word,
        }

    finally:
        db.close()

    # Private delivery: do not use manager.broadcast() here.
    await websocket.send_json(secret_word_message)

async def send_current_timer_state(
    websocket: WebSocket,
    room_id: int,
    room_code: str,
) -> None:
    """
    Send the current round's remaining time to one WebSocket connection.

    The remaining time comes from the round's original started_at
    timestamp, so reconnecting does not reset the countdown.
    """

    db: Session = SessionLocal()

    try:
        current_room = db.execute(
            select(GameRoom).where(GameRoom.id == room_id)
        ).scalar_one_or_none()

        if (
            current_room is None
            or current_room.status != ROOM_STATUS_IN_PROGRESS
        ):
            return

        current_round = db.execute(
            select(GameRound).where(
                GameRound.room_id == current_room.id,
                GameRound.round_number == current_room.current_round,
            )
        ).scalar_one_or_none()

        if (
            current_round is None
            or current_round.status != ROUND_STATUS_IN_PROGRESS
        ):
            return

        round_id = current_round.id
        round_number = current_round.round_number

    finally:
        db.close()

    remaining_seconds = round_timer_service.get_remaining_seconds(
        room_code=room_code,
        round_id=round_id,
    )

    if remaining_seconds is None:
        return

    await websocket.send_json(
        {
            "type": "round_timer",
            "round_id": round_id,
            "round_number": round_number,
            "remaining_seconds": remaining_seconds,
        }
    )

@router.websocket("/ws/rooms/{room_code}")
async def room_websocket(
    websocket: WebSocket,
    room_code: str,
):
    normalized_room_code = room_code.strip().upper()
    session_token = websocket.query_params.get("session_token")

    if not session_token:
        await websocket.close(
            code=1008,
            reason="Session token is required.",
        )
        return

    db: Session = SessionLocal()

    try:
        room = RoomRepository.get_by_code(
            db=db,
            room_code=normalized_room_code,
        )

        if room is None:
            await websocket.close(
                code=1008,
                reason="Room not found.",
            )
            return

        player = PlayerRepository.get_by_session_token(
            db=db,
            session_token=session_token,
        )

        if player is None:
            await websocket.close(
                code=1008,
                reason="Invalid player session token.",
            )
            return

        if player.room_id != room.id:
            await websocket.close(
                code=1008,
                reason="Player does not belong to this room.",
            )
            return

        player_id = player.id
        display_name = player.display_name
        room_id = room.id

    finally:
        db.close()

    previous_player_connections = (
        manager.get_player_connection_count(
            normalized_room_code,
            player_id,
        )
    )

    await manager.connect(
        normalized_room_code,
        websocket,
        player_id,
    )

    try:
        update_player_connection_status(player_id, True)

        # Start or resume the active round timer.
        # Repeated connections will not create duplicate timers.
        db = SessionLocal()

        try:
            current_room = db.get(GameRoom, room_id)

            if (
                current_room is not None
                and current_room.status == ROOM_STATUS_IN_PROGRESS
            ):
                current_round = db.execute(
                    select(GameRound).where(
                        GameRound.room_id == current_room.id,
                        GameRound.round_number == current_room.current_round,
                    )
                ).scalar_one_or_none()

                if (
                    current_round is not None
                    and current_round.status == ROUND_STATUS_IN_PROGRESS
                ):
                    active_round_id = current_round.id
                else:
                    active_round_id = None
            else:
                active_round_id = None

        finally:
            db.close()

        if active_round_id is not None:
            await round_timer_service.start_or_resume(
                room_code=normalized_room_code,
                round_id=active_round_id,
            )

        # Send the secret word privately if this player is the
        # drawer of the currently active round.
        await send_secret_word_if_drawer(
            websocket=websocket,
            room_id=room_id,
            player_id=player_id,
        )

        # Immediately send this connection the current countdown.
        await send_current_timer_state(
            websocket=websocket,
            room_id=room_id,
            room_code=normalized_room_code,
        )

        # Notify the room only when this player connects for the
        # first time, not for additional connections.
        if previous_player_connections == 0:
            await manager.broadcast(
                normalized_room_code,
                {
                    "type": "player_connected",
                    "player_id": player_id,
                    "display_name": display_name,
                    "connected_players": manager.get_connection_count(
                        normalized_room_code
                    ),
                },
            )

        while True:
            try:
                message = await websocket.receive_json()

            except ValueError:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Message must contain valid JSON.",
                    }
                )
                continue

            validated_message, validation_error = (
                validate_drawing_message(message)
            )

            if validation_error:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": validation_error,
                    }
                )
                continue

            if validated_message is None:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Invalid drawing message.",
                    }
                )
                continue

            db = SessionLocal()

            try:
                current_room = db.execute(
                    select(GameRoom).where(
                        GameRoom.id == room_id
                    )
                ).scalar_one_or_none()

                current_player = db.execute(
                    select(Player).where(
                        Player.id == player_id
                    )
                ).scalar_one_or_none()

                if current_room is None or current_player is None:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": "Room or player no longer exists.",
                        }
                    )

                    await websocket.close(
                        code=1008,
                        reason="Room or player no longer exists.",
                    )
                    return

                if current_player.room_id != current_room.id:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": (
                                "Player no longer belongs to this room."
                            ),
                        }
                    )

                    await websocket.close(
                        code=1008,
                        reason="Player does not belong to this room.",
                    )
                    return

                if current_room.status != ROOM_STATUS_IN_PROGRESS:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": (
                                "Drawing is only allowed while "
                                "a game is in progress."
                            ),
                        }
                    )
                    continue

                current_round = db.execute(
                    select(GameRound).where(
                        GameRound.room_id == current_room.id,
                        GameRound.round_number
                        == current_room.current_round,
                    )
                ).scalar_one_or_none()

                if (
                    current_round is None
                    or current_round.status != ROUND_STATUS_IN_PROGRESS
                ):
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": (
                                "There is no active round to draw in."
                            ),
                        }
                    )
                    continue

                if current_round.drawer_id != current_player.id:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "detail": (
                                "Only the current drawer can draw "
                                "or clear the canvas."
                            ),
                        }
                    )
                    continue

                outgoing_message = dict(validated_message)
                outgoing_message["player_id"] = current_player.id
                outgoing_message["display_name"] = (
                    current_player.display_name
                )
                outgoing_message["round_number"] = (
                    current_round.round_number
                )

            finally:
                db.close()

            await manager.broadcast(
                normalized_room_code,
                outgoing_message,
            )

    except WebSocketDisconnect:
        pass

    finally:
        manager.disconnect(
            normalized_room_code,
            websocket,
        )

        remaining_connections = manager.get_player_connection_count(
            normalized_room_code,
            player_id,
        )

        try:
            update_player_connection_status(
                player_id,
                remaining_connections > 0,
            )
        except Exception:
            # Socket cleanup should continue if the database is
            # temporarily unavailable.
            pass

        # Notify the room only when the player's last connection closes.
        if remaining_connections == 0:
            await manager.broadcast(
                normalized_room_code,
                {
                    "type": "player_disconnected",
                    "player_id": player_id,
                    "display_name": display_name,
                    "connected_players": manager.get_connection_count(
                        normalized_room_code
                    ),
                },
            )
