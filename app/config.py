from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="APP_",
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "demo", "test"] = "development"
    data_dir: Path = PROJECT_ROOT / "data"

    @property
    def database_path(self) -> Path:
        directory = self.data_dir
        if not directory.is_absolute():
            directory = PROJECT_ROOT / directory
        return directory / f"{self.environment}.db"
