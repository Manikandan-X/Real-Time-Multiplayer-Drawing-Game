from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}
        self.player_connections: dict[
            str, dict[int, list[WebSocket]]
        ] = {}
        self.websocket_players: dict[
            WebSocket, tuple[str, int]
        ] = {}

    async def connect(
        self,
        room_code: str,
        websocket: WebSocket,
        player_id: int,
    ) -> None:
        normalized_room_code = room_code.strip().upper()

        await websocket.accept()

        self.active_connections.setdefault(
            normalized_room_code, []
        ).append(websocket)

        room_players = self.player_connections.setdefault(
            normalized_room_code, {}
        )

        room_players.setdefault(player_id, []).append(websocket)

        self.websocket_players[websocket] = (
            normalized_room_code,
            player_id,
        )

    def disconnect(
        self,
        room_code: str,
        websocket: WebSocket,
    ) -> tuple[str, int] | None:
        normalized_room_code = room_code.strip().upper()

        websocket_details = self.websocket_players.pop(
            websocket, None
        )

        if websocket_details is None:
            return None

        stored_room_code, player_id = websocket_details

        connections = self.active_connections.get(
            stored_room_code, []
        )

        if websocket in connections:
            connections.remove(websocket)

        if not connections:
            self.active_connections.pop(
                stored_room_code, None
            )

        room_players = self.player_connections.get(
            stored_room_code, {}
        )

        player_websockets = room_players.get(player_id, [])

        if websocket in player_websockets:
            player_websockets.remove(websocket)

        if not player_websockets:
            room_players.pop(player_id, None)

        if not room_players:
            self.player_connections.pop(
                stored_room_code, None
            )

        return stored_room_code, player_id

    async def broadcast(
        self,
        room_code: str,
        message: dict,
    ) -> None:
        normalized_room_code = room_code.strip().upper()

        connections = self.active_connections.get(
            normalized_room_code, []
        )

        disconnected_connections = []

        for websocket in connections.copy():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected_connections.append(websocket)

        for websocket in disconnected_connections:
            self.disconnect(normalized_room_code, websocket)

    async def send_to_player(
        self,
        room_code: str,
        player_id: int,
        message: dict,
    ) -> None:
        """
        Send a message only to the specified player's
        active WebSocket connections in the room.
        """
        normalized_room_code = room_code.strip().upper()

        room_players = self.player_connections.get(
            normalized_room_code, {}
        )

        player_websockets = room_players.get(
            player_id, []
        )

        disconnected_connections = []

        for websocket in player_websockets.copy():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected_connections.append(websocket)

        for websocket in disconnected_connections:
            self.disconnect(normalized_room_code, websocket)

    def get_connection_count(self, room_code: str) -> int:
        normalized_room_code = room_code.strip().upper()

        return len(
            self.active_connections.get(
                normalized_room_code, []
            )
        )

    def get_player_connection_count(
        self,
        room_code: str,
        player_id: int,
    ) -> int:
        normalized_room_code = room_code.strip().upper()

        room_players = self.player_connections.get(
            normalized_room_code, {}
        )

        return len(room_players.get(player_id, []))

    def is_player_connected(
        self,
        room_code: str,
        player_id: int,
    ) -> bool:
        return (
            self.get_player_connection_count(
                room_code, player_id
            ) > 0
        )


manager = ConnectionManager()
