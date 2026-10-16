import asyncio
import logging
import math
from datetime import datetime

from app.core.constants import (
    ROOM_STATUS_COMPLETED,
    ROOM_STATUS_IN_PROGRESS,
    ROUND_DURATION_SECONDS,
    ROUND_STATUS_IN_PROGRESS,
)
from app.db.session import SessionLocal
from app.models.game_round import GameRound
from app.models.game_room import GameRoom
from app.services.connection_manager import manager
from app.services.room_service import RoomService
from app.services.round_event_service import broadcast_round_ended

logger = logging.getLogger(__name__)

TIMER_UPDATE_INTERVAL_SECONDS = 1
MAX_FINISH_RETRIES = 5


class RoundTimerService:
    """
    Manages server-side countdown timers for multiplayer game rounds.

    The remaining time is calculated from the round's stored started_at
    timestamp. Reconnecting players therefore do not receive a reset timer.
    """

    def __init__(self):
        self._tasks: dict[str, asyncio.Task] = {}
        self._round_ids: dict[str, int] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    def _get_lock(self, room_code: str) -> asyncio.Lock:
        return self._locks.setdefault(room_code, asyncio.Lock())

    @staticmethod
    def _calculate_remaining_seconds(started_at: datetime) -> int:
        """Calculate remaining time using the original round start time."""

        if started_at.tzinfo is not None:
            now = datetime.now(started_at.tzinfo)
        else:
            now = datetime.now()

        elapsed_seconds = (now - started_at).total_seconds()

        return max(
            0,
            math.ceil(ROUND_DURATION_SECONDS - elapsed_seconds),
        )

    def get_remaining_seconds(self, room_code: str, round_id: int) -> int | None:
        """
        Return the remaining time for an active round.

        Returns None if the room or round is not currently active.
        """

        normalized_room_code = room_code.strip().upper()
        db = SessionLocal()

        try:
            room = (
                db.query(GameRoom)
                .filter(GameRoom.room_code == normalized_room_code)
                .first()
            )

            game_round = (
                db.query(GameRound)
                .filter(GameRound.id == round_id)
                .first()
            )

            if (
                room is None
                or game_round is None
                or room.status != ROOM_STATUS_IN_PROGRESS
                or room.current_round != game_round.round_number
                or game_round.room_id != room.id
                or game_round.status != ROUND_STATUS_IN_PROGRESS
                or game_round.started_at is None
            ):
                return None

            return self._calculate_remaining_seconds(game_round.started_at)

        finally:
            db.close()

    async def start_or_resume(
        self,
        room_code: str,
        round_id: int,
    ) -> None:
        """
        Start a timer or resume the countdown for the specified round.

        Repeated calls for the same round do not create duplicate tasks.
        """

        normalized_room_code = room_code.strip().upper()

        async with self._get_lock(normalized_room_code):
            existing_task = self._tasks.get(normalized_room_code)
            existing_round_id = self._round_ids.get(normalized_room_code)

            if (
                existing_task is not None
                and not existing_task.done()
                and existing_round_id == round_id
            ):
                return

            if existing_task is not None and not existing_task.done():
                existing_task.cancel()

            task = asyncio.create_task(
                self._run_timer(
                    room_code=normalized_room_code,
                    round_id=round_id,
                )
            )

            self._tasks[normalized_room_code] = task
            self._round_ids[normalized_room_code] = round_id

    async def cancel(self, room_code: str) -> None:
        """Cancel the active countdown for a room."""

        normalized_room_code = room_code.strip().upper()

        async with self._get_lock(normalized_room_code):
            task = self._tasks.pop(normalized_room_code, None)
            self._round_ids.pop(normalized_room_code, None)

            if task is not None and not task.done():
                task.cancel()

    async def _run_timer(
        self,
        room_code: str,
        round_id: int,
    ) -> None:
        """Broadcast countdown updates and complete expired rounds."""

        current_task = asyncio.current_task()
        failed_finish_attempts = 0

        try:
            while True:
                # Stop if another request replaced this timer.
                if self._tasks.get(room_code) is not current_task:
                    return

                db = SessionLocal()

                try:
                    room = (
                        db.query(GameRoom)
                        .filter(GameRoom.room_code == room_code)
                        .first()
                    )

                    game_round = (
                        db.query(GameRound)
                        .filter(GameRound.id == round_id)
                        .first()
                    )

                    if (
                        room is None
                        or game_round is None
                        or room.status != ROOM_STATUS_IN_PROGRESS
                        or room.current_round != game_round.round_number
                        or game_round.room_id != room.id
                        or game_round.status != ROUND_STATUS_IN_PROGRESS
                        or game_round.started_at is None
                    ):
                        return

                    remaining_seconds = self._calculate_remaining_seconds(
                        game_round.started_at
                    )

                    round_number = game_round.round_number

                finally:
                    db.close()

                await manager.broadcast(
                    room_code,
                    {
                        "type": "round_timer",
                        "round_id": round_id,
                        "round_number": round_number,
                        "remaining_seconds": remaining_seconds,
                    },
                )

                if remaining_seconds <= 0:
                    result = await self._finish_expired_round(
                        room_code=room_code,
                        round_id=round_id,
                    )

                    # A concurrent manual finish may have replaced this task.
                    if self._tasks.get(room_code) is not current_task:
                        return

                    if result is not None:
                        if result.get("status") == ROOM_STATUS_COMPLETED:
                            return

                    # Read the database to determine whether a next round
                    # was created by this timer or another request.
                    db = SessionLocal()

                    try:
                        room = (
                            db.query(GameRoom)
                            .filter(GameRoom.room_code == room_code)
                            .first()
                        )

                        if room is None or room.status == ROOM_STATUS_COMPLETED:
                            return

                        next_round = (
                            db.query(GameRound)
                            .filter(
                                GameRound.room_id == room.id,
                                GameRound.round_number == room.current_round,
                                GameRound.status == ROUND_STATUS_IN_PROGRESS,
                            )
                            .first()
                        )

                        if next_round is None:
                            return

                        next_round_id = next_round.id
                        next_round_number = next_round.round_number
                        next_drawer_id = next_round.drawer_id
                        next_secret_word = next_round.secret_word

                    finally:
                        db.close()

                    # A different round means another request may have
                    # completed the previous round manually.
                    if next_round_id == round_id:
                        # The automatic finish failed (for example a
                        # transient database error). Retry instead of
                        # leaving the room stuck on an expired round.
                        failed_finish_attempts += 1

                        if failed_finish_attempts >= MAX_FINISH_RETRIES:
                            logger.error(
                                "Round %s in room %s expired and could not "
                                "be finished after %s attempts.",
                                round_id,
                                room_code,
                                failed_finish_attempts,
                            )
                            return

                        logger.warning(
                            "Round %s in room %s expired but did not "
                            "transition. Retrying (%s/%s).",
                            round_id,
                            room_code,
                            failed_finish_attempts,
                            MAX_FINISH_RETRIES,
                        )
                        await asyncio.sleep(TIMER_UPDATE_INTERVAL_SECONDS)
                        continue

                    failed_finish_attempts = 0

                    if next_drawer_id is None:
                        logger.error(
                            "Active round %s in room %s has no drawer.",
                            next_round_id,
                            room_code,
                        )
                        return

                    if self._tasks.get(room_code) is not current_task:
                        return

                    # Update the tracked round ID before broadcasting.
                    self._round_ids[room_code] = next_round_id
                    round_id = next_round_id

                    # Only the next drawer receives the secret word.
                    await manager.send_to_player(
                        room_code,
                        next_drawer_id,
                        {
                            "type": "secret_word",
                            "round_id": next_round_id,
                            "word": next_secret_word,
                        },
                    )

                    await manager.broadcast(
                        room_code,
                        {
                            "type": "round_started",
                            "room_code": room_code,
                            "round_id": next_round_id,
                            "round_number": next_round_number,
                            "drawer_id": next_drawer_id,
                            "duration_seconds": ROUND_DURATION_SECONDS,
                        },
                    )

                    # Continue using the next round's stored started_at.
                    continue

                await asyncio.sleep(TIMER_UPDATE_INTERVAL_SECONDS)

        except asyncio.CancelledError:
            raise

        except Exception:
            logger.exception(
                "Round timer failed for room %s, round %s.",
                room_code,
                round_id,
            )

        finally:
            # Do not remove a newer task that replaced this one.
            if self._tasks.get(room_code) is current_task:
                self._tasks.pop(room_code, None)
                self._round_ids.pop(room_code, None)

    async def _finish_expired_round(
        self,
        room_code: str,
        round_id: int,
    ) -> dict | None:
        """
        Finish an expired round using RoomService.

        If another request has already completed the round, return None
        rather than allowing this timer to finish a different round.
        """

        db = SessionLocal()

        try:
            result = RoomService().finish_round_automatically(
                db=db,
                room_code=room_code,
                round_id=round_id,
            )

            await broadcast_round_ended(
                room_code=room_code,
                round_id=round_id,
            )

            if result.get("status") == ROOM_STATUS_COMPLETED:
                await manager.broadcast(
                    room_code,
                    {
                        "type": "game_completed",
                        "room_code": room_code,
                        "status": ROOM_STATUS_COMPLETED,
                    },
                )

            return result

        except Exception:
            db.rollback()

            logger.exception(
                "Could not automatically finish round %s in room %s.",
                round_id,
                room_code,
            )

            # Do not retry against an unknown round state here.
            # The next request can resume from the database state.
            return None

        finally:
            db.close()


round_timer_service = RoundTimerService()