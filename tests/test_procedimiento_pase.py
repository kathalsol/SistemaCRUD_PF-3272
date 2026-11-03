import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess

import pytest


POWERSHELL = shutil.which("pwsh") or shutil.which("powershell")
pytestmark = pytest.mark.skipif(
    os.name != "nt" or not POWERSHELL,
    reason="El procedimiento documentado requiere PowerShell en Windows",
)


@pytest.mark.parametrize("escenario", ["copia_falla", "copia_corrupta", "correcto"])
def test_reversion_preserva_datos_hasta_verificar_respaldo(tmp_path, escenario):
    datos = tmp_path / "datos"
    respaldo = tmp_path / "respaldo"
    datos.mkdir()
    respaldo.mkdir()
    actual = datos / "demo.db"
    anterior = respaldo / "demo-antes-v0.1.0.db"
    posterior = respaldo / "demo-despues-pruebas.db"
    for archivo, clientes in [(anterior, [(1,)]), (actual, [(1,), (2,)])]:
        with sqlite3.connect(archivo) as db:
            db.execute("CREATE TABLE clientes (id INTEGER PRIMARY KEY)")
            db.executemany("INSERT INTO clientes VALUES (?)", clientes)
        db.close()
    original = actual.read_bytes()
    contexto = tmp_path / "contexto.json"
    contexto.write_text(json.dumps({"datos": str(datos), "respaldo": str(respaldo)}), encoding="utf-8")

    documento = Path(__file__).resolve().parents[1] / "docs/procedimiento-pase.md"
    seccion = documento.read_text(encoding="utf-8").split("## 5. Ensayar reversión", 1)[1]
    bloque = re.search(r"```powershell\n(.*?)```", seccion, re.S).group(1)
    preparacion = ""
    if escenario == "copia_falla":
        preparacion = """
$paseBloqueo = [System.IO.File]::Open(
    (Join-Path $pase.respaldo 'demo-despues-pruebas.db'),
    [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite,
    [System.IO.FileShare]::None)
"""
    elif escenario == "copia_corrupta":
        preparacion = """
function Copy-Item {
    [CmdletBinding()]
    param([string]$LiteralPath, [string]$Destination, [switch]$Force)
    Microsoft.PowerShell.Management\\Copy-Item @PSBoundParameters
    if ($Destination -eq (Join-Path $pase.respaldo 'demo-despues-pruebas.db')) {
        [System.IO.File]::AppendAllText($Destination, 'corrupcion simulada')
    }
}
"""
    script = tmp_path / "ensayo.ps1"
    script.write_text(
        "param([string]$Contexto)\n"
        "$pase = Get-Content -Raw -LiteralPath $Contexto | ConvertFrom-Json\n"
        "function Get-NetTCPConnection {}\n"
        + preparacion + "\ntry {\n& {\n" + bloque
        + "\n}\n} finally { if ($paseBloqueo) { $paseBloqueo.Dispose() } }\n",
        encoding="utf-8-sig",
    )
    resultado = subprocess.run(
        [POWERSHELL, "-NoProfile", "-NonInteractive", "-File", str(script), "-Contexto", str(contexto)],
        cwd=tmp_path, capture_output=True, text=True, timeout=30,
    )
    if escenario == "correcto":
        assert resultado.returncode == 0, resultado.stderr
        assert posterior.read_bytes() == original
        assert actual.read_bytes() == anterior.read_bytes()
    else:
        assert actual.read_bytes() == original, "La restauración descartó datos sin respaldo verificado"
        assert resultado.returncode != 0, resultado.stdout
