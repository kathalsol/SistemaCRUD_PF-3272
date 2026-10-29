from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClienteBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombre: str = Field(min_length=1, max_length=100)
    correo: EmailStr = Field(max_length=254)
    telefono: str = Field(min_length=1, max_length=30)


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
