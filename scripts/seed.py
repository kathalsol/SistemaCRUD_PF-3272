"""Carga clientes de ejemplo en la base del ambiente configurado.

Uso: python -m scripts.seed
Solo inserta datos si la tabla está vacía, por lo que puede ejecutarse varias veces.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import create_database_engine
from app.models import Base, Cliente

CLIENTES_EJEMPLO = [
    {"nombre": "Ana Rodríguez", "correo": "ana.rodriguez@example.com", "telefono": 88123456},
    {"nombre": "Carlos Jiménez", "correo": "carlos.jimenez@example.com", "telefono": 87234567},
    {"nombre": "María Fernández", "correo": "maria.fernandez@example.com", "telefono": 60345678},
    {"nombre": "José Vargas", "correo": "jose.vargas@example.com", "telefono": 71456789},
    {"nombre": "Laura Mora", "correo": "laura.mora@example.com", "telefono": 22567890},
]


def seed(settings: Settings) -> int:
    engine = create_database_engine(settings)
    try:
        Base.metadata.create_all(engine)
        with Session(engine) as session:
            if session.scalar(select(func.count()).select_from(Cliente)):
                return 0
            session.add_all(Cliente(**datos) for datos in CLIENTES_EJEMPLO)
            session.commit()
            return len(CLIENTES_EJEMPLO)
    finally:
        engine.dispose()


def main() -> None:
    settings = Settings()
    insertados = seed(settings)
    if insertados:
        print(f"Se insertaron {insertados} clientes en {settings.database_path}")
    else:
        print(f"La tabla ya tiene datos; no se insertó nada en {settings.database_path}")


if __name__ == "__main__":
    main()
