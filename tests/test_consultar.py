from pathlib import Path

import pytest
from fastapi.testclient import TestClient
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


def guardar_cliente(
    client: TestClient,
    nombre: str = "Cliente de prueba",
    correo: str = "cliente@example.com",
    telefono: int = 88888888,
) -> int:
    with Session(client.app.state.engine) as session:
        cliente = Cliente(nombre=nombre, correo=correo, telefono=telefono)
        session.add(cliente)
        session.commit()
        return cliente.id


def test_listar_sin_registros_devuelve_lista_vacia(client: TestClient):
    response = client.get("/api/clientes")

    assert response.status_code == 200
    assert response.json() == []


def test_listar_con_registros_ordenados_por_id(client: TestClient):
    primero = guardar_cliente(client, "Ana", "ana@example.com", 22223333)
    segundo = guardar_cliente(client, "Luis", "luis@example.com", 87654321)

    response = client.get("/api/clientes")

    assert response.status_code == 200
    assert response.json() == [
        {"id": primero, "nombre": "Ana", "correo": "ana@example.com",
         "telefono": 22223333, "codigo_pais": 506},
        {"id": segundo, "nombre": "Luis", "correo": "luis@example.com",
         "telefono": 87654321, "codigo_pais": 506},
    ]


def test_consultar_cliente_existente(client: TestClient):
    guardar_cliente(client, "Otro cliente", "otro@example.com")
    cliente_id = guardar_cliente(client)

    response = client.get(f"/api/clientes/{cliente_id}")

    assert response.status_code == 200
    assert response.json() == {
        "id": cliente_id,
        "nombre": "Cliente de prueba",
        "correo": "cliente@example.com",
        "telefono": 88888888,
        "codigo_pais": 506,
    }


def test_consultar_inexistente_devuelve_404(client: TestClient):
    cliente_id = guardar_cliente(client)

    response = client.get(f"/api/clientes/{cliente_id + 1}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Cliente no encontrado"}


@pytest.mark.parametrize("cliente_id", ["abc", "1.5", "0", "-1", "9223372036854775808"])
def test_consultar_rechaza_identificador_invalido(client: TestClient, cliente_id: str):
    assert client.get(f"/api/clientes/{cliente_id}").status_code == 422


def test_consulta_persiste_al_reiniciar(settings: Settings):
    with TestClient(create_app(settings)) as client:
        cliente_id = guardar_cliente(client)

    with TestClient(create_app(settings)) as restarted:
        assert restarted.get(f"/api/clientes/{cliente_id}").status_code == 200
        assert [c["id"] for c in restarted.get("/api/clientes").json()] == [cliente_id]


def test_listado_incluye_clientes_creados_por_la_api(client: TestClient):
    creado = client.post(
        "/api/clientes",
        json={"nombre": "Desde API", "correo": "api@example.com", "telefono": 81234567},
    ).json()

    assert client.get("/api/clientes").json() == [creado]
    assert client.get(f"/api/clientes/{creado['id']}").json() == creado


def test_pantalla_y_recursos_disponibles(client: TestClient):
    assert 'href="/clientes/consultar"' in client.get("/").text
    pagina = client.get("/clientes/consultar")
    assert pagina.status_code == 200
    assert "text/html" in pagina.headers["content-type"]
    assert 'href="/static/css/styles.css"' in pagina.text
    for recurso in ["/static/js/consultar.js", "/static/css/consultar.css"]:
        assert client.get(recurso).status_code == 200


def test_contrato_openapi_declara_404_en_consulta(client: TestClient):
    contrato = client.get("/openapi.json").json()
    assert "200" in contrato["paths"]["/api/clientes"]["get"]["responses"]
    assert "404" in contrato["paths"]["/api/clientes/{cliente_id}"]["get"]["responses"]
