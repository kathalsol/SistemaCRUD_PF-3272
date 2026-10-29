from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import Cliente
from app.schemas import ClienteActualizar, ClienteCrear, ClienteRespuesta


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(_env_file=None, environment="test", data_dir=tmp_path)


def test_inicio_estado_y_documentacion(settings: Settings):
    app = create_app(settings)
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/health").json() == {
            "status": "ok",
            "environment": "test",
        }
        assert client.get("/docs").status_code == 200
        assert client.get("/openapi.json").status_code == 200
        assert inspect(app.state.engine).get_columns("clientes")
    assert settings.database_path.is_file()


def test_persistencia_al_reiniciar(settings: Settings):
    app = create_app(settings)
    with TestClient(app):
        with Session(app.state.engine) as session:
            cliente = Cliente(
                nombre="Cliente de prueba",
                correo="cliente@example.com",
                telefono="8888-8888",
            )
            session.add(cliente)
            session.commit()
            cliente_id = cliente.id
            assert ClienteRespuesta.model_validate(cliente).id == cliente_id

    restarted_app = create_app(settings)
    with TestClient(restarted_app):
        with Session(restarted_app.state.engine) as session:
            guardado = session.get(Cliente, cliente_id)
            assert guardado is not None
            assert guardado.nombre == "Cliente de prueba"
            assert guardado.correo == "cliente@example.com"
            assert guardado.telefono == "8888-8888"


def test_ambientes_usan_bases_separadas(tmp_path: Path):
    development = Settings(
        _env_file=None, environment="development", data_dir=tmp_path
    )
    demo = Settings(_env_file=None, environment="demo", data_dir=tmp_path)
    assert development.database_path != demo.database_path

    app = create_app(development)
    with TestClient(app):
        with Session(app.state.engine) as session:
            session.add(Cliente(nombre="Solo desarrollo", correo="dev@example.com", telefono="123"))
            session.commit()

    demo_app = create_app(demo)
    with TestClient(demo_app):
        with Session(demo_app.state.engine) as session:
            assert session.scalars(select(Cliente)).all() == []


@pytest.mark.parametrize("schema", [ClienteCrear, ClienteActualizar])
def test_normaliza_campos(schema):
    cliente = schema(
        nombre="  Cliente  ", correo="cliente@example.com", telefono=" 8888-8888 "
    )
    assert cliente.nombre == "Cliente"
    assert cliente.telefono == "8888-8888"


@pytest.mark.parametrize("schema", [ClienteCrear, ClienteActualizar])
@pytest.mark.parametrize(
    "changes",
    [
        {"nombre": "   "},
        {"nombre": "a" * 101},
        {"correo": "correo-invalido"},
        {"telefono": ""},
        {"telefono": "a" * 31},
        {"id": 10},
    ],
)
def test_rechaza_datos_invalidos(schema, changes):
    datos = {
        "nombre": "Cliente",
        "correo": "cliente@example.com",
        "telefono": "8888-8888",
    }
    datos.update(changes)
    with pytest.raises(ValidationError):
        schema(**datos)


@pytest.mark.parametrize("campo", ["nombre", "correo", "telefono"])
def test_campos_obligatorios(campo):
    datos = {
        "nombre": "Cliente",
        "correo": "cliente@example.com",
        "telefono": "8888-8888",
    }
    del datos[campo]
    with pytest.raises(ValidationError):
        ClienteCrear(**datos)
