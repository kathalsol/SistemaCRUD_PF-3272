"""Comprueba el CRUD en una instancia local demo con datos sintéticos propios.

python -m scripts.verificar_demo --url http://127.0.0.1:8015 --salida resultado.json
Después de reiniciar el servidor:
python -m scripts.verificar_demo --url http://127.0.0.1:8015 --persistencia resultado.json
"""

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4


def verificar(url: str, anterior: dict | None = None) -> dict:
    address = urlsplit(url)
    if (
        address.scheme != "http"
        or address.hostname not in {"127.0.0.1", "localhost", "::1"}
        or address.username or address.password or address.query or address.fragment
        or address.path not in {"", "/"}
    ):
        raise ValueError("Usar una URL HTTP local, sin ruta ni credenciales.")

    resultado = {
        "fecha_costa_rica": datetime.now(timezone(timedelta(hours=-6))).isoformat(),
        "url": url.rstrip("/"),
        "modo": "persistencia" if anterior is not None else "crud",
        "comprobaciones": [],
        "correcto": False,
    }

    def peticion(method: str, path: str, esperado: int, datos=None):
        body = None if datos is None else json.dumps(datos).encode("utf-8")
        request = Request(
            resultado["url"] + path, data=body, method=method,
            headers={"Content-Type": "application/json"},
        )
        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            raw = response.read()
            status = response.status
        resultado["comprobaciones"].append({
            "metodo": method, "ruta": path, "estado": status, "esperado": esperado,
        })
        if status != esperado:
            raise RuntimeError(f"{method} {path}: esperado {esperado}, recibido {status}")
        if esperado == 204:
            if raw:
                raise RuntimeError("DELETE 204 debe responder sin cuerpo")
            return None
        return json.loads(raw)

    def exigir(condicion: bool, mensaje: str):
        if not condicion:
            raise RuntimeError(mensaje)

    try:
        health = peticion("GET", "/health", 200)
        exigir(health == {"status": "ok", "environment": "demo"}, "La instancia debe ser demo")
        resultado["health"] = health

        if anterior is not None:
            exigir(anterior.get("correcto") is True, "El registro anterior no fue satisfactorio")
            exigir(anterior.get("url") == resultado["url"], "La URL debe coincidir con la prueba anterior")
            guardado = anterior["cliente_persistente"]
            actual = peticion("GET", f"/api/clientes/{guardado['id']}", 200)
            exigir(actual == guardado, "El cliente cambió o no persistió después del reinicio")
            resultado["cliente_persistente"] = actual
            resultado["persistencia_verificada"] = True
        else:
            antes = peticion("GET", "/api/clientes", 200)
            token = uuid4().hex[:12]
            datos = {
                "nombre": f"Prueba de pase {token}",
                "correo": f"pase.{token}@example.com",
                "telefono": 88888888,
                "codigo_pais": 506,
            }
            creado = peticion("POST", "/api/clientes", 201, datos)
            cliente_id = creado["id"]
            exigir(creado == {**datos, "id": cliente_id}, "Los datos creados no coinciden")
            listado = peticion("GET", "/api/clientes", 200)
            exigir(creado in listado, "El cliente creado no aparece en el listado")
            exigir(peticion("GET", f"/api/clientes/{cliente_id}", 200) == creado, "Consulta inconsistente")

            cambios = {**datos, "nombre": f"Cliente actualizado {token}", "telefono": 77777777}
            editado = peticion("PUT", f"/api/clientes/{cliente_id}", 200, cambios)
            exigir(editado == {**cambios, "id": cliente_id}, "La edición no devolvió los cambios")
            exigir(peticion("GET", f"/api/clientes/{cliente_id}", 200) == editado, "La edición no persistió")
            peticion("DELETE", f"/api/clientes/{cliente_id}", 204)
            peticion("GET", f"/api/clientes/{cliente_id}", 404)
            peticion("DELETE", f"/api/clientes/{cliente_id}", 404)
            exigir(peticion("GET", "/api/clientes", 200) == antes, "Se alteraron otros clientes")

            # Se conserva este único registro sintético para comprobar el reinicio.
            persistente = peticion("POST", "/api/clientes", 201, datos)
            resultado["cliente_persistente"] = persistente
            resultado["otros_clientes_conservados"] = True
        resultado["correcto"] = True
    except Exception as error:
        resultado["error"] = str(error)
    return resultado


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--salida", type=Path)
    parser.add_argument("--persistencia", type=Path)
    args = parser.parse_args()
    if args.salida and args.salida.exists():
        parser.error("La evidencia ya existe; usar otro archivo para conservarla.")
    anterior = None
    if args.persistencia:
        anterior = json.loads(args.persistencia.read_text(encoding="utf-8"))
    resultado = verificar(args.url, anterior)
    text = json.dumps(resultado, ensure_ascii=False, indent=2) + "\n"
    if args.salida:
        args.salida.parent.mkdir(parents=True, exist_ok=True)
        args.salida.write_text(text, encoding="utf-8")
    print(text)
    return 0 if resultado["correcto"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
