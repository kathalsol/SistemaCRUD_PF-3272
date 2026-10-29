from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import URL, Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.config import Settings


class Base(DeclarativeBase):
    pass


def create_database_engine(settings: Settings) -> Engine:
    path = settings.database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return create_engine(
        URL.create("sqlite", database=str(path)),
        connect_args={"check_same_thread": False},
    )


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session
