from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import Settings
from app.main import create_app
from app.models import Cliente

DATOS_NUEVOS = {
    "nombre": "Cliente editado",
    "correo": "editado@example.com",
    "telefono": 77777777,
}


@pytest.fixture
def app(tmp_path: Path) -> FastAPI:
    settings = Settings(_env_file=None, environment="test", data_dir=tmp_path)
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI):
    with TestClient(app) as client:
        yield client


@pytest.fixture
def cliente_id(app: FastAPI, client: TestClient) -> int:
    with Session(app.state.engine) as session:
        cliente = Cliente(
            nombre="Cliente original",
            correo="original@example.com",
            telefono=88888888,
        )
        session.add(cliente)
        session.commit()
        return cliente.id


def test_editar_cliente(app: FastAPI, client: TestClient, cliente_id: int):
    response = client.put(f"/api/clientes/{cliente_id}", json=DATOS_NUEVOS)

    assert response.status_code == 200
    assert response.json() == {"id": cliente_id, "codigo_pais": 506, **DATOS_NUEVOS}

    with Session(app.state.engine) as session:
        guardado = session.get(Cliente, cliente_id)
        assert guardado.nombre == DATOS_NUEVOS["nombre"]
        assert guardado.correo == DATOS_NUEVOS["correo"]
        assert guardado.telefono == DATOS_NUEVOS["telefono"]


def test_editar_cliente_normaliza_campos(client: TestClient, cliente_id: int):
    response = client.put(
        f"/api/clientes/{cliente_id}",
        json={**DATOS_NUEVOS, "nombre": "  Cliente  "},
    )

    assert response.status_code == 200
    assert response.json()["nombre"] == "Cliente"
    assert response.json()["telefono"] == 77777777


def test_editar_cliente_inexistente(client: TestClient):
    response = client.put("/api/clientes/999", json=DATOS_NUEVOS)

    assert response.status_code == 404
    assert response.json() == {"detail": "Cliente no encontrado"}


@pytest.mark.parametrize(
    "changes",
    [
        {"nombre": "   "},
        {"correo": "correo-invalido"},
        {"telefono": ""},
        {"telefono": "77777777"},
        {"telefono": 1234567},
        {"telefono": 100000000},
        {"codigo_pais": 1},
        {"id": 10},
    ],
)
def test_editar_cliente_rechaza_datos_invalidos(
    app: FastAPI, client: TestClient, cliente_id: int, changes: dict
):
    response = client.put(
        f"/api/clientes/{cliente_id}", json={**DATOS_NUEVOS, **changes}
    )

    assert response.status_code == 422
    with Session(app.state.engine) as session:
        assert session.get(Cliente, cliente_id).nombre == "Cliente original"


def test_editar_cliente_requiere_todos_los_campos(client: TestClient, cliente_id: int):
    response = client.put(
        f"/api/clientes/{cliente_id}", json={"nombre": "Solo nombre"}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("cliente_id", ["abc", "1.5", "0", "-1", "9223372036854775808"])
def test_editar_rechaza_identificador_invalido(client: TestClient, cliente_id: str):
    response = client.put(f"/api/clientes/{cliente_id}", json=DATOS_NUEVOS)

    assert response.status_code == 422


def test_editar_solo_modifica_el_cliente_indicado(
    app: FastAPI, client: TestClient, cliente_id: int
):
    with Session(app.state.engine) as session:
        otro = Cliente(nombre="Otro cliente", correo="otro@example.com", telefono=66666666)
        session.add(otro)
        session.commit()
        otro_id = otro.id

    response = client.put(f"/api/clientes/{cliente_id}", json=DATOS_NUEVOS)

    assert response.status_code == 200
    assert client.get(f"/api/clientes/{otro_id}").json() == {
        "id": otro_id,
        "nombre": "Otro cliente",
        "correo": "otro@example.com",
        "telefono": 66666666,
        "codigo_pais": 506,
    }


def test_pantalla_y_recursos_disponibles(client: TestClient):
    assert 'href="/clientes/editar"' in client.get("/").text
    pagina = client.get("/clientes/editar")
    assert pagina.status_code == 200
    assert "text/html" in pagina.headers["content-type"]
    assert 'href="/static/css/styles.css"' in pagina.text
    assert 'src="/static/js/editar.js"' in pagina.text
    assert '<select id="cliente-id"' in pagina.text
    for campo in ["nombre", "correo", "telefono"]:
        assert f'id="{campo}"' in pagina.text
        assert f'id="{campo}-error"' in pagina.text
    assert 'type="tel"' in pagina.text
    assert 'type="number"' not in pagina.text
    assert 'pattern="[1-9][0-9]{7}"' in pagina.text
    assert "+506" in pagina.text
    assert "<style>" not in pagina.text
    for recurso in ["/static/js/editar.js", "/static/css/editar.css"]:
        assert client.get(recurso).status_code == 200


def test_contrato_openapi_declara_404_en_edicion(client: TestClient):
    respuestas = client.get("/openapi.json").json()["paths"]["/api/clientes/{cliente_id}"]["put"]["responses"]
    assert "404" in respuestas
