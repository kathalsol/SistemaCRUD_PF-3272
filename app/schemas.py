from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClienteBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombre: str = Field(min_length=1, max_length=100)
    correo: EmailStr = Field(max_length=254)
    telefono: int = Field(strict=True, ge=10_000_000, le=99_999_999)
    codigo_pais: Literal[506] = 506


class ClienteCrear(ClienteBase):
    pass


class ClienteActualizar(ClienteBase):
    pass


class ClienteRespuesta(ClienteBase):
    model_config = ConfigDict(
        from_attributes=True, str_strip_whitespace=True, extra="forbid"
    )

    id: int


class EstadoRespuesta(BaseModel):
    status: str
    environment: str
