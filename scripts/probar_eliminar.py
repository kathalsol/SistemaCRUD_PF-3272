"""Ejecutar desde la raíz: python -m scripts.probar_eliminar."""

from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import Base, create_database_engine
from app.main import create_app
from app.models import Cliente


def main() -> None:
    with TemporaryDirectory(prefix="crud-eliminar-") as directorio:
        settings = Settings(
            _env_file=None, environment="test", data_dir=Path(directorio)
        )
        engine = create_database_engine(settings)
        try:
            Base.metadata.create_all(engine)
            with Session(engine) as session:
                session.add_all([
                    Cliente(
                        id=1, nombre="Cliente de prueba 1",
                        correo="uno@example.com", telefono=88888888,
                    ),
                    Cliente(
                        id=2, nombre="Cliente de prueba 2",
                        correo="dos@example.com", telefono=77777777,
                    ),
                ])
                session.commit()
        finally:
            engine.dispose()

        print(f"Base temporal: {settings.database_path}")
        print("Clientes disponibles: 1 y 2. La base se elimina al salir con Ctrl+C.")
        print("Abrir http://127.0.0.1:8002/clientes/eliminar")
        uvicorn.run(create_app(settings), host="127.0.0.1", port=8002)


if __name__ == "__main__":
    main()
