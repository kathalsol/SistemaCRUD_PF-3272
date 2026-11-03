# Procedimiento reproducible de pase local

Este procedimiento reproduce el ensayo de [v0.1.0](pase-v0.1.0.md) en Windows
PowerShell. Utiliza dos terminales: **A** mantiene el servidor en primer plano y
**B** realiza las comprobaciones. Detener A con Ctrl+C antes de cada cambio de
versión o copia de SQLite. No usar `--reload`.

## Responsabilidades

| Etapa | Coordinación del equipo | Ejecución de este ensayo |
| --- | --- | --- |
| Verificar versión, pruebas y CRUD | Ney | Codex por solicitud de Esteban; resultados adjuntos |
| Autorizar el pase | Esteban | Autorización de Esteban para la simulación local, registrada tras comprobar condiciones |
| Respaldo, despliegue y reversión | Roberto | Codex por solicitud de Esteban; resultados adjuntos |

La autorización de este ensayo está en [autorizacion.json](evidencias/pase-v0.1.0/autorizacion.json).
Para una versión o destino diferente se deben verificar sus condiciones y
registrar su autorización, sin reutilizar el registro como si fuera un pase nuevo.

## 1. Preparar código y directorios independientes

Se requiere un checkout que incluya este documento y `scripts/verificar_demo.py`,
Python 3.12, Node.js y Git. Para obtener el repositorio por primera vez:

```powershell
git clone https://github.com/kathalsol/SistemaCRUD_PF-3272.git
Set-Location SistemaCRUD_PF-3272
```

Antes de integrar esta documentación en `main`, usar la rama del PR de evidencias.
Desde la raíz de ese checkout, en A:

```powershell
if (-not (Test-Path -LiteralPath .venv/Scripts/python.exe)) {
    py -3.12 -m venv .venv
}
$paseRepo = (Get-Location).Path
$pasePython = Join-Path $paseRepo '.venv/Scripts/python.exe'
& $pasePython -m pip install -r docs/evidencias/pase-v0.1.0/dependencias.txt
if ($LASTEXITCODE -ne 0) { throw 'No se instalaron las dependencias' }
git fetch origin --tags
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron actualizar las referencias' }
$paseRoot = Join-Path $env:TEMP ('crud-pase-' + [guid]::NewGuid())
$pase = [pscustomobject]@{
    repo = $paseRepo
    python = $pasePython
    version = Join-Path $paseRoot 'version'
    anterior = Join-Path $paseRoot 'anterior'
    datos = Join-Path $paseRoot 'datos-demo'
    respaldo = Join-Path $paseRoot 'respaldo'
    evidencias = Join-Path $paseRoot 'evidencias'
}
New-Item -ItemType Directory -Path $pase.datos,$pase.respaldo,$pase.evidencias | Out-Null
git worktree add --detach $pase.version f4a105e08dadd796757de61961e177f5d0ab35c8
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar v0.1.0' }
git worktree add --detach $pase.anterior 87f549edef3539ac561c9c6c172597f485033f7b
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la version anterior' }
$pase | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $paseRoot 'contexto.json')
Write-Output (Join-Path $paseRoot 'contexto.json')
```

En B, copiar la ruta de `contexto.json` impresa por A:

```powershell
$pase = Get-Content -LiteralPath '<ruta impresa>/contexto.json' | ConvertFrom-Json
```

Todos los datos de esta repetición quedan dentro del directorio temporal nuevo;
no se utiliza la base de desarrollo. Si el puerto 8015 está ocupado, detener el
procedimiento y elegir otro puerto consistente en los comandos y la URL.

## 2. Verificar antes de autorizar

En A, comprobar tag, historial, esquema y pruebas sobre el código exacto:

```powershell
git rev-parse v0.1.0
git -C $pase.version rev-parse HEAD
git diff --exit-code 87f549e f4a105e -- app/models.py app/schemas.py app/database.py
if ($LASTEXITCODE -ne 0) { throw 'Revisar compatibilidad de datos antes de revertir' }
$env:PYTHONDONTWRITEBYTECODE = '1'
Push-Location $pase.version
& $pase.python -m pytest -q -p no:cacheprovider
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas Python' }
$paseJs = Get-ChildItem -LiteralPath tests -Filter '*.cjs' | ForEach-Object { $_.FullName }
node --test $paseJs
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas JavaScript' }
Pop-Location
```

Ambos SHA deben ser `f4a105e08dadd796757de61961e177f5d0ab35c8`. Revisar también
las aprobaciones e integración de los PR #2, #3, #4, #5 y #6 y las reglas de
`main`. En el ensayo adjunto pasaron 127 pruebas Python y 81 JavaScript.

## 3. Preparar y respaldar el ambiente anterior

En A:

```powershell
$env:APP_ENVIRONMENT = 'demo'
$env:APP_DATA_DIR = $pase.datos
Set-Location $pase.anterior
& $pase.python -m uvicorn app.main:app --host 127.0.0.1 --port 8015 --no-use-colors
```

En B, crear el cliente sintético que permitirá comprobar el respaldo:

```powershell
$paseHealth = Invoke-RestMethod http://127.0.0.1:8015/health
if ($paseHealth.environment -ne 'demo') { throw 'La instancia no es demo' }
$paseBody = @{ nombre='Cliente previo al pase'; correo='previo@example.com'; telefono=22223333 } | ConvertTo-Json
$paseCliente = Invoke-RestMethod http://127.0.0.1:8015/api/clientes -Method Post -ContentType 'application/json' -Body $paseBody
$paseCliente | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $pase.evidencias 'cliente-previo.json')
```

Detener A con Ctrl+C y esperar el mensaje de cierre. En B:

```powershell
if (Get-NetTCPConnection -LocalPort 8015 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Detener la instancia antes del respaldo'
}
Copy-Item -LiteralPath (Join-Path $pase.datos 'demo.db') -Destination (Join-Path $pase.respaldo 'demo-antes-v0.1.0.db')
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $pase.datos 'demo.db'),(Join-Path $pase.respaldo 'demo-antes-v0.1.0.db')
& $pase.python -c "import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute('PRAGMA integrity_check').fetchone()[0])" (Join-Path $pase.respaldo 'demo-antes-v0.1.0.db')
```

Los hashes deben coincidir y SQLite debe responder `ok`. Registrar entonces
versión/SHA, quién autoriza, fecha de Costa Rica, ambiente, resultados de
pruebas, respaldo y versión de reversión. La autorización debe preceder al
arranque de la versión nueva. El registro del ensayo adjunto muestra ese orden.

## 4. Desplegar v0.1.0 y verificar

En A, conservando `APP_ENVIRONMENT=demo` y el mismo `APP_DATA_DIR`:

```powershell
Set-Location $pase.version
& $pase.python -m uvicorn app.main:app --host 127.0.0.1 --port 8015 --no-use-colors
```

En B:

```powershell
& $pase.python (Join-Path $pase.repo 'scripts/verificar_demo.py') --url http://127.0.0.1:8015 --salida (Join-Path $pase.evidencias 'posdespliegue.json')
if ($LASTEXITCODE -ne 0) { throw 'Fallo la verificacion posdespliegue' }
```

El verificador exige `demo` y una URL local. Crea sus propios datos sintéticos,
comprueba POST/listado/consulta/PUT/DELETE/404 y conserva un cliente para probar
persistencia. No modifica registros preexistentes. Sus salidas incluyen los
estados HTTP; no sobrescribe un archivo de evidencia existente.

En el navegador, abrir `/clientes/consultar`. Entrar a eliminar el cliente
sintético conservado, pulsar Continuar y Cancelar; repetir con Escape. Comprobar
que el cliente permanece y que Network no registra DELETE al cancelar. Para
probar confirmación sin perder el cliente de persistencia, registrar otro
cliente sintético, confirmar su eliminación y comprobar el 404 posterior.
Guardar capturas del listado, confirmación y cancelación.

Detener A y volver a ejecutar el mismo comando de v0.1.0. En B:

```powershell
& $pase.python (Join-Path $pase.repo 'scripts/verificar_demo.py') --url http://127.0.0.1:8015 --persistencia (Join-Path $pase.evidencias 'posdespliegue.json') --salida (Join-Path $pase.evidencias 'persistencia.json')
if ($LASTEXITCODE -ne 0) { throw 'Fallo la persistencia despues del reinicio' }
```

## 5. Ensayar reversión

Detener A. En B, guardar el estado posterior antes de restaurar:

```powershell
if (Get-NetTCPConnection -LocalPort 8015 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Detener la instancia antes de restaurar'
}
Copy-Item -LiteralPath (Join-Path $pase.datos 'demo.db') -Destination (Join-Path $pase.respaldo 'demo-despues-pruebas.db')
Copy-Item -LiteralPath (Join-Path $pase.respaldo 'demo-antes-v0.1.0.db') -Destination (Join-Path $pase.datos 'demo.db') -Force
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $pase.datos 'demo.db'),(Join-Path $pase.respaldo 'demo-antes-v0.1.0.db')
```

**La copia anterior reemplaza los datos por el respaldo y descarta los cambios
posteriores.** Este ensayo utiliza exclusivamente datos sintéticos y conserva
también el respaldo posterior. Volver al código anterior por sí solo no restaura
SQLite. Para una base real habría que evaluar la compatibilidad y la pérdida de
cambios antes de restaurar; esta comprobación solo cubre los dos commits citados.

En A, arrancar desde `$pase.anterior` con el comando de la etapa 3. En B:

```powershell
Invoke-RestMethod http://127.0.0.1:8015/health
Invoke-RestMethod http://127.0.0.1:8015/api/clientes
Invoke-RestMethod http://127.0.0.1:8015/api/clientes/1
```

Debe reaparecer únicamente el cliente previo al pase. Comprobar además
creación, consulta y eliminación de un nuevo cliente sintético usando `/docs`.
La versión anterior no implementaba edición: PUT devuelve 405. Registrar esa
limitación, el checksum restaurado y los estados observados; no presentar el
resultado como una reversión con edición disponible.

Detener A, arrancar nuevamente desde `$pase.version` y repetir el verificador
completo con una salida nueva, por ejemplo `redespliegue.json`. Detener el
servidor al terminar y conservar las evidencias. En el ensayo adjunto se volvió
a verificar el CRUD completo de v0.1.0 antes del cierre.

## Qué automatizaría un pipeline

1. Preparar dependencias y ejecutar pytest y pruebas JavaScript por PR.
2. Asociar un artefacto inmutable al tag y al SHA comprobados.
3. Requerir aprobación de Esteban para el destino demo, con las evidencias previas.
4. Detener la instancia, respaldar SQLite y comprobar su integridad/checksum.
5. Desplegar el artefacto y ejecutar `verificar_demo.py`; publicar resultados.
6. Si falla, recuperar el código anterior y evaluar/restaurar datos según el
   procedimiento; volver a comprobar el servicio.

Este repositorio conserva un procedimiento manual reproducible y un verificador
ejecutable. No se afirma que exista un pipeline configurado ni un despliegue remoto.
