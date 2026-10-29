from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import models
from app.config import Settings
from app.database import create_database_engine, get_session
from app.routers import router
from app.schemas import EstadoRespuesta


def create_app(settings: Settings | None = None) -> FastAPI:
    configuration = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        engine = create_database_engine(configuration)
        application.state.engine = engine
        try:
            models.Base.metadata.create_all(engine)
            yield
        finally:
            engine.dispose()

    application = FastAPI(
        title="Sistema CRUD de clientes",
        description="Base compartida para el desarrollo colaborativo del equipo.",
        version="0.1.0",
        lifespan=lifespan,
    )
    application.state.settings = configuration
    application.include_router(router)

    @application.get("/", include_in_schema=False)
    def inicio() -> FileResponse:
        return FileResponse(Path(__file__).parent / "templates" / "index.html")

    @application.get("/health", tags=["Sistema"], response_model=EstadoRespuesta)
    def health(session: Session = Depends(get_session)) -> EstadoRespuesta:
        session.execute(text("SELECT 1"))
        return EstadoRespuesta(
            status="ok", environment=configuration.environment
        )

    return application


app = create_app()
