import io
import json
import sys

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from scripts import verificar_demo


URL = "http://127.0.0.1:8015"


@pytest.fixture
def demo(tmp_path, monkeypatch):
    settings = Settings(_env_file=None, environment="demo", data_dir=tmp_path / "datos")
    with TestClient(create_app(settings)) as client:
        cliente = client.post("/api/clientes", json={
            "nombre": "Cliente previo", "correo": "previo@example.com",
            "telefono": 22223333, "codigo_pais": 506,
        }).json()
        peticiones = []

        def transporte(request, timeout):
            peticiones.append((request.method, request.full_url))
            response = client.request(
                request.method, request.full_url, content=request.data,
                headers=dict(request.header_items()),
            )
            body = io.BytesIO(response.content)
            body.status = response.status_code
            return body

        monkeypatch.setattr(verificar_demo, "urlopen", transporte)
        yield client, cliente, peticiones


def evidencia(cliente):
    return {
        "modo": "crud", "correcto": True, "url": URL,
        "health": {"status": "ok", "environment": "demo"},
        "cliente_persistente": cliente,
    }


def ejecutar_persistencia(tmp_path, monkeypatch, contenido):
    archivo = tmp_path / "anterior.json"
    archivo.write_text(json.dumps(contenido), encoding="utf-8")
    salida = tmp_path / "resultado.json"
    monkeypatch.setattr(sys, "argv", [
        "verificar_demo", "--url", URL, "--persistencia", str(archivo),
        "--salida", str(salida),
    ])
    codigo = verificar_demo.main()
    return codigo, json.loads(salida.read_text(encoding="utf-8"))


@pytest.mark.parametrize("contenido", [None, [], False, 1, "texto", {}])
def test_evidencia_invalida_no_envia_peticiones(demo, tmp_path, monkeypatch, contenido):
    client, cliente, peticiones = demo
    codigo, resultado = ejecutar_persistencia(tmp_path, monkeypatch, contenido)
    assert codigo != 0
    assert resultado["modo"] == "persistencia"
    assert resultado["correcto"] is False
    assert peticiones == []
    assert client.get("/api/clientes").json() == [cliente]


@pytest.mark.parametrize("cambio", [
    {"correcto": False},
    {"url": "http://127.0.0.1:9999"},
    {"cliente_persistente": None},
    {"cliente_persistente": {"id": 1}},
    {"health": {"status": "ok", "environment": "development"}},
])
def test_evidencia_incompleta_no_envia_peticiones(demo, tmp_path, monkeypatch, cambio):
    client, cliente, peticiones = demo
    codigo, resultado = ejecutar_persistencia(
        tmp_path, monkeypatch, {**evidencia(cliente), **cambio},
    )
    assert codigo != 0 and resultado["correcto"] is False
    assert peticiones == []
    assert client.get("/api/clientes").json() == [cliente]


@pytest.mark.parametrize("cliente_id", [None, True, 0, -1, "1", "1/../2"])
def test_id_invalido_no_envia_peticiones(demo, tmp_path, monkeypatch, cliente_id):
    client, cliente, peticiones = demo
    anterior = evidencia({**cliente, "id": cliente_id})
    codigo, resultado = ejecutar_persistencia(tmp_path, monkeypatch, anterior)
    assert codigo != 0 and resultado["correcto"] is False
    assert peticiones == []
    assert client.get("/api/clientes").json() == [cliente]


def test_persistencia_valida_solo_consulta(demo, tmp_path, monkeypatch):
    client, cliente, peticiones = demo
    codigo, resultado = ejecutar_persistencia(tmp_path, monkeypatch, evidencia(cliente))
    assert codigo == 0 and resultado["persistencia_verificada"] is True
    assert resultado["cliente_persistente"] == cliente
    assert peticiones == [("GET", URL + "/health"), ("GET", URL + "/api/clientes/1")]
    assert client.get("/api/clientes").json() == [cliente]


def test_persistencia_detecta_cambios_sin_escribir(demo, tmp_path, monkeypatch):
    client, cliente, peticiones = demo
    anterior = evidencia({**cliente, "nombre": "Nombre anterior"})
    codigo, resultado = ejecutar_persistencia(tmp_path, monkeypatch, anterior)
    assert codigo != 0 and resultado["correcto"] is False
    assert all(metodo == "GET" for metodo, _ in peticiones)
    assert client.get("/api/clientes").json() == [cliente]


def test_sin_persistencia_ejecuta_crud_y_conserva_otros_clientes(demo, tmp_path, monkeypatch):
    client, cliente, peticiones = demo
    salida = tmp_path / "crud.json"
    monkeypatch.setattr(sys, "argv", ["verificar_demo", "--url", URL, "--salida", str(salida)])
    assert verificar_demo.main() == 0
    resultado = json.loads(salida.read_text(encoding="utf-8"))
    assert resultado["modo"] == "crud" and resultado["correcto"] is True
    assert {metodo for metodo, _ in peticiones} == {"GET", "POST", "PUT", "DELETE"}
    assert client.get("/api/clientes").json() == [cliente, resultado["cliente_persistente"]]
