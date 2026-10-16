from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Real-Time Multiplayer Drawing Game"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True


    MYSQL_DATABASE: str = "drawing_game_db"
    MYSQL_USER: str = "drawing_game_user"
    MYSQL_PASSWORD: str
    MYSQL_ROOT_PASSWORD: str

    DB_HOST: str = "mysql"
    DB_PORT: int = 3306

    DATABASE_URL: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    

settings = Settings()
