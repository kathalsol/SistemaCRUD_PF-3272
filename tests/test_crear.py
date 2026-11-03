from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import Cliente


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(_env_file=None, environment="test", data_dir=tmp_path)


@pytest.fixture
def client(settings: Settings):
    with TestClient(create_app(settings)) as client:
        yield client


@pytest.fixture
def datos():
    return {
        "nombre": "Cliente de prueba",
        "correo": "cliente@example.com",
        "telefono": 88888888,
        "codigo_pais": 506,
    }


def test_registrar_y_persistir_al_reiniciar(client, settings, datos):
    response = client.post("/api/clientes", json=datos)
    assert response.status_code == 201
    cliente_id = response.json()["id"]
    assert isinstance(cliente_id, int)
    assert cliente_id > 0
    assert response.json() == {"id": cliente_id, **datos}

    restarted_app = create_app(settings)
    with TestClient(restarted_app):
        with Session(restarted_app.state.engine) as session:
            cliente = session.get(Cliente, cliente_id)
            assert cliente is not None
            assert cliente.nombre == datos["nombre"]
            assert cliente.correo == datos["correo"]
            assert cliente.telefono == datos["telefono"]


def test_identificadores_distintos(client, datos):
    primero = client.post("/api/clientes", json=datos)
    segundo = client.post("/api/clientes", json={**datos, "nombre": "Otro cliente"})
    assert primero.status_code == segundo.status_code == 201
    assert primero.json()["id"] != segundo.json()["id"]


def test_normaliza_nombre_y_guarda_telefono_entero(client, datos):
    response = client.post(
        "/api/clientes", json={**datos, "nombre": "  Cliente  ", "telefono": 12345678}
    )
    assert response.status_code == 201
    assert response.json()["nombre"] == "Cliente"
    assert response.json()["telefono"] == 12345678
    assert type(response.json()["telefono"]) is int
    with Session(client.app.state.engine) as session:
        assert type(session.get(Cliente, response.json()["id"]).telefono) is int


def test_limites_permitidos(client, datos):
    response = client.post(
        "/api/clientes", json={**datos, "nombre": "a" * 100, "telefono": 99_999_999}
    )
    assert response.status_code == 201


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("nombre", ""),
        ("nombre", "   "),
        ("nombre", "a" * 101),
        ("correo", ""),
        ("correo", "correo-invalido"),
        ("correo", "a" * 243 + "@example.com"),
        ("telefono", ""),
        ("telefono", "   "),
        ("telefono", 100_000_000),
        ("telefono", 0),
        ("telefono", 1),
        ("telefono", 1234567),
        ("telefono", 9999999),
        ("telefono", -123),
        ("telefono", 8888.5),
        ("telefono", 88888888.0),
        ("telefono", True),
        ("telefono", "88888888"),
        ("telefono", "8888-8888"),
        ("telefono", "+50688888888"),
        ("telefono", "123abc"),
        ("telefono", None),
        ("codigo_pais", 507),
        ("codigo_pais", "+506"),
        ("nombre", None),
        ("id", 999),
    ],
)
def test_datos_invalidos_no_se_guardan(client, datos, campo, valor):
    response = client.post("/api/clientes", json={**datos, campo: valor})
    assert response.status_code == 422
    assert any(error["loc"] == ["body", campo] for error in response.json()["detail"])
    with Session(client.app.state.engine) as session:
        assert session.scalars(select(Cliente)).all() == []


@pytest.mark.parametrize("campo", ["nombre", "correo", "telefono"])
def test_campos_obligatorios(client, datos, campo):
    del datos[campo]
    response = client.post("/api/clientes", json=datos)
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", campo]


def test_formulario_y_recursos(client):
    inicio = client.get("/")
    assert 'href="/clientes/crear"' in inicio.text
    formulario = client.get("/clientes/crear")
    assert formulario.status_code == 200
    assert 'id="crear-cliente"' in formulario.text
    for campo in ["nombre", "correo", "telefono"]:
        assert f'id="{campo}"' in formulario.text
        assert f'id="{campo}-error"' in formulario.text
    assert 'src="/static/js/crear.js"' in formulario.text
    assert 'type="tel"' in formulario.text
    assert 'type="number"' not in formulario.text
    assert 'minlength="8"' in formulario.text
    assert 'maxlength="8"' in formulario.text
    assert 'pattern="[1-9][0-9]{7}"' in formulario.text
    assert "+506" in formulario.text
    assert client.get("/static/js/crear.js").status_code == 200
    assert client.get("/static/css/styles.css").status_code == 200


def test_contrato_openapi(client):
    schema = client.get("/openapi.json").json()
    operation = schema["paths"]["/api/clientes"]["post"]
    assert "201" in operation["responses"]
    assert "422" in operation["responses"]
    telefono = schema["components"]["schemas"]["ClienteCrear"]["properties"]["telefono"]
    assert telefono["type"] == "integer"
    assert telefono["minimum"] == 10_000_000
    assert telefono["maximum"] == 99_999_999


@pytest.mark.parametrize("telefono", [10000000, 12345678, 88888888, 99999999])
def test_telefono_valido_con_pais_predeterminado(client, datos, telefono):
    del datos["codigo_pais"]
    response = client.post("/api/clientes", json={**datos, "telefono": telefono})
    assert response.status_code == 201
    assert response.json()["telefono"] == telefono
    assert response.json()["codigo_pais"] == 506


def test_fallo_base_no_devuelve_exito(settings, datos, monkeypatch):
    def fallar_commit(session):
        raise OperationalError("INSERT", {}, RuntimeError("Fallo de escritura"))

    monkeypatch.setattr(Session, "commit", fallar_commit)
    app = create_app(settings)
    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.post("/api/clientes", json=datos).status_code == 500
        with Session(app.state.engine) as session:
            assert session.scalars(select(Cliente)).all() == []
