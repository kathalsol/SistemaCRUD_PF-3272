from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
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


def guardar_cliente(client: TestClient, nombre: str = "Cliente de prueba") -> int:
    with Session(client.app.state.engine) as session:
        cliente = Cliente(
            nombre=nombre, correo="cliente@example.com", telefono="8888-8888"
        )
        session.add(cliente)
        session.commit()
        return cliente.id


def test_eliminar_confirma_transaccion_y_conserva_otros_clientes(client: TestClient):
    cliente_id = guardar_cliente(client)
    otro_id = guardar_cliente(client, "Cliente que permanece")

    response = client.delete(f"/api/clientes/{cliente_id}")

    assert response.status_code == 204
    assert response.content == b""
    # Una sesión nueva comprueba que DELETE confirmó la transacción.
    with Session(client.app.state.engine) as session:
        assert session.get(Cliente, cliente_id) is None
        assert session.get(Cliente, otro_id).nombre == "Cliente que permanece"


def test_eliminar_inexistente_no_modifica_clientes(client: TestClient):
    cliente_id = guardar_cliente(client)

    response = client.delete(f"/api/clientes/{cliente_id + 1}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Cliente no encontrado"}
    with Session(client.app.state.engine) as session:
        assert [cliente.id for cliente in session.scalars(select(Cliente))] == [cliente_id]


def test_eliminar_dos_veces_devuelve_404(client: TestClient):
    cliente_id = guardar_cliente(client)

    assert client.delete(f"/api/clientes/{cliente_id}").status_code == 204
    assert client.delete(f"/api/clientes/{cliente_id}").status_code == 404


@pytest.mark.parametrize("cliente_id", ["abc", "1.5", "0", "-1", "9223372036854775808"])
def test_eliminar_rechaza_identificador_invalido(client: TestClient, cliente_id: str):
    guardado_id = guardar_cliente(client)

    assert client.delete(f"/api/clientes/{cliente_id}").status_code == 422
    with Session(client.app.state.engine) as session:
        assert session.get(Cliente, guardado_id) is not None


def test_eliminacion_persiste_al_reiniciar(settings: Settings):
    with TestClient(create_app(settings)) as client:
        cliente_id = guardar_cliente(client)
        assert client.delete(f"/api/clientes/{cliente_id}").status_code == 204

    with TestClient(create_app(settings)) as restarted:
        with Session(restarted.app.state.engine) as session:
            assert session.get(Cliente, cliente_id) is None
        assert restarted.delete(f"/api/clientes/{cliente_id}").status_code == 404


def test_pantalla_y_recursos_disponibles(client: TestClient):
    assert 'href="/clientes/eliminar"' in client.get("/").text
    pagina = client.get("/clientes/eliminar")
    assert pagina.status_code == 200
    assert "text/html" in pagina.headers["content-type"]
    for recurso in ["/static/js/eliminar.js", "/static/css/eliminar.css"]:
        assert client.get(recurso).status_code == 200


def test_contrato_openapi_no_declara_cuerpo_para_204(client: TestClient):
    contrato = client.get("/openapi.json").json()
    respuestas = contrato["paths"]["/api/clientes/{cliente_id}"]["delete"]["responses"]
    assert "content" not in respuestas["204"]
    assert "404" in respuestas
