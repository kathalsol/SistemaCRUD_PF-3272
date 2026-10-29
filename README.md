# SistemaCRUD_PF-3272
TRABAJO FINAL Curso PF-3872 Parte 2 Desarrollo colaborativo y pase a producción

## Base compartida

Aplicación con **Python 3.12+, FastAPI, SQLAlchemy y SQLite**. Incluye una
página de inicio, documentación de API, comprobación de conexión, modelo de
cliente, validaciones y pruebas. **No implementa todavía las operaciones CRUD
ni su interfaz**: cada integrante desarrolla su parte sobre esta misma base.

## Instalación y ejecución

Ejecutar desde la raíz del proyecto. En Linux o WSL:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
python -m uvicorn app.main:app --reload
```

En Windows (PowerShell, con un checkout local de Windows):

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload
```

No compartir un entorno virtual entre Windows y WSL. Para ejecutar sin activar
el entorno, usar `.venv/bin/python` en Linux o `.\.venv\Scripts\python.exe`
en Windows. En una instalación de demostración basta con `requirements.txt`.

- Inicio: <http://127.0.0.1:8000/>
- Swagger: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>
- Estado y conexión SQLite: <http://127.0.0.1:8000/health>

La tabla `clientes` se crea al iniciar la aplicación. La base predeterminada es
`data/development.db`; reiniciar no borra los registros. No subir `.env`, bases
de datos ni el entorno virtual al repositorio.

## Estructura y trabajo por integrante

```text
app/
  config.py             Configuración por ambiente
  database.py           Motor, modelo base y dependencia de sesión
  models.py             Tabla Cliente compartida
  schemas.py            Contratos y validación de datos
  main.py               Aplicación, inicio y estado
  routers/
    __init__.py         Prefijo común e integración de routers
    crear.py            Persona 1
    consultar.py        Persona 2
    editar.py           Persona 3
    eliminar.py         Persona 4
  templates/
    index.html          Página inicial; pendiente interfaz CRUD
tests/
  test_base.py          Pruebas de infraestructura y contratos
```

Los cuatro routers están conectados, pero no declaran endpoints todavía.
Acuerdo de rutas para el desarrollo:

| Operación | Método y ruta | Contrato esperado |
| --- | --- | --- |
| Crear | `POST /api/clientes` | `ClienteCrear` → `ClienteRespuesta`, estado 201 |
| Listar | `GET /api/clientes` | Lista de `ClienteRespuesta`, estado 200 |
| Consultar | `GET /api/clientes/{cliente_id}` | `ClienteRespuesta`, estado 200; 404 si no existe |
| Editar | `PUT /api/clientes/{cliente_id}` | `ClienteActualizar` → `ClienteRespuesta`; 404 si no existe |
| Eliminar | `DELETE /api/clientes/{cliente_id}` | Estado 204 sin cuerpo; 404 si no existe |

En los módulos usar rutas relativas al prefijo común: `@router.post("")` o
`@router.get("/{cliente_id}")`, por ejemplo. Obtener la sesión con
`session: Session = Depends(get_session)`, importando `Session` de
`sqlalchemy.orm`, `Depends` de `fastapi` y `get_session` de `app.database`.
Cada escritura debe llamar a `session.commit()` y, cuando corresponda,
`session.refresh(cliente)`. La dependencia cierra la sesión al terminar la
petición; no confirma escrituras automáticamente.

`id` es un entero generado por SQLite. Los cuerpos de creación y edición usan
`nombre` (1–100 caracteres), `correo` (correo válido, hasta 254 caracteres) y
`telefono` (1–30 caracteres). El teléfono es texto para preservar prefijos y
ceros. Nombre y teléfono eliminan espacios en los extremos; no se aceptan
campos adicionales. `PUT` requiere los tres campos. FastAPI responde con 422
cuando el cuerpo no cumple el esquema.

La confirmación de eliminación debe implementarse en la interfaz: cancelar no
debe enviar `DELETE`. Coordinar cambios a archivos compartidos antes de
modificarlos. Agregar pruebas por operación en archivos separados y evitar
reescribir la infraestructura para cada funcionalidad.

## Pruebas

```bash
python -m pytest -q
```

Las pruebas usan directorios temporales: comprueban inicio, documentación,
creación del esquema, validaciones, persistencia tras reiniciar y aislamiento
entre ambientes. No modifican la base de desarrollo.

## Configuración y demostración

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `APP_ENVIRONMENT` | `development` | `development`, `demo` o `test` |
| `APP_DATA_DIR` | `data` en la raíz del proyecto | Directorio de las bases SQLite |

La aplicación lee `.env` desde la raíz; las variables de entorno tienen
prioridad. Las rutas relativas de `APP_DATA_DIR` se resuelven desde esa raíz,
no desde el directorio de ejecución. Cada ambiente utiliza un archivo distinto:
`development.db`, `demo.db` o `test.db`.

Para una instancia de demostración separada en Linux/WSL:

```bash
APP_ENVIRONMENT=demo python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

En PowerShell:

```powershell
$env:APP_ENVIRONMENT = "demo"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
# Al terminar la demostración:
Remove-Item Env:APP_ENVIRONMENT
```

Comprobar <http://127.0.0.1:8001/health>: debe indicar `"environment":"demo"`.
No usar `--reload` para la demostración ni exponer esta base a Internet:
todavía no tiene autenticación. `create_all` crea tablas faltantes, pero **no
migra tablas existentes**; cualquier cambio posterior al esquema requiere
acordar una migración.

Antes del pase, completar el CRUD, ejecutar sus pruebas, registrar la aprobación
y asociar una etiqueta al commit verificado. Respaldar la base de demostración
con la aplicación detenida antes de sustituir la versión. Para revertir, detener
la instancia, recuperar la versión anterior y restaurar el respaldo únicamente
si corresponde: esto elimina los cambios de datos posteriores al respaldo.
Reiniciar y comprobar `/health` y el CRUD; regresar al código anterior no
revierte automáticamente los datos.

## Colaboración

`dev` contiene la base de integración. Publicarla con `git push -u origin dev`
cuando el equipo esté listo; cada persona debe crear su rama a partir de esa
base, aportar sus propios commits y abrir un PR para revisión por otra persona.
No trabajar las cuatro funcionalidades directamente en `dev`.

Las protecciones y aprobaciones de `main` se configuran en el proveedor del
repositorio; crear esta base no las configura automáticamente.
