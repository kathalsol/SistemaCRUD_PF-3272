from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Cliente(Base):
    __tablename__ = "clientes"
    __table_args__ = (
        CheckConstraint(
            "typeof(telefono) = 'integer' AND telefono BETWEEN 10000000 AND 99999999",
            name="telefono_valido",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    correo: Mapped[str] = mapped_column(String(254), nullable=False)
    telefono: Mapped[int] = mapped_column(nullable=False)
