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
    "telefono": "7777-7777",
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
            telefono="8888-8888",
        )
        session.add(cliente)
        session.commit()
        return cliente.id


def test_editar_cliente(app: FastAPI, client: TestClient, cliente_id: int):
    response = client.put(f"/api/clientes/{cliente_id}", json=DATOS_NUEVOS)

    assert response.status_code == 200
    assert response.json() == {"id": cliente_id, **DATOS_NUEVOS}

    with Session(app.state.engine) as session:
        guardado = session.get(Cliente, cliente_id)
        assert guardado.nombre == DATOS_NUEVOS["nombre"]
        assert guardado.correo == DATOS_NUEVOS["correo"]
        assert guardado.telefono == DATOS_NUEVOS["telefono"]


def test_editar_cliente_normaliza_campos(client: TestClient, cliente_id: int):
    response = client.put(
        f"/api/clientes/{cliente_id}",
        json={**DATOS_NUEVOS, "nombre": "  Cliente  ", "telefono": " 7777-7777 "},
    )

    assert response.status_code == 200
    assert response.json()["nombre"] == "Cliente"
    assert response.json()["telefono"] == "7777-7777"


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


def test_editar_cliente_id_no_numerico(client: TestClient):
    response = client.put("/api/clientes/abc", json=DATOS_NUEVOS)

    assert response.status_code == 422


def test_pagina_editar(client: TestClient):
    response = client.get("/editar")

    assert response.status_code == 200
    assert "Editar cliente" in response.text
