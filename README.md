# SistemaCRUD_PF-3272
TRABAJO FINAL Curso PF-3872 Parte 2 Desarrollo colaborativo y pase a producción

## Base compartida

Aplicación con **Python 3.12+, FastAPI, SQLAlchemy y SQLite**. Incluye una
página de inicio, documentación de API, comprobación de conexión, modelo de
cliente, validaciones y pruebas. **El registro y la eliminación de clientes
están implementados, con sus API y formularios**, incluida la confirmación o
cancelación de la eliminación. Consultar y editar quedan pendientes de integrar.

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
- Registro de clientes: <http://127.0.0.1:8000/clientes/crear>
- Eliminar cliente: <http://127.0.0.1:8000/clientes/eliminar>
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
    eliminar.py         Esteban: DELETE con estados 204 y 404
  templates/
    index.html          Página inicial y navegación
    crear.html          Formulario de registro
    eliminar.html       Confirmación y cancelación de eliminación
  static/
    css/styles.css      Estilos compartidos
    js/crear.js         Envío y mensajes de validación del registro
    js/eliminar.js      Validación, confirmación y llamada DELETE
    css/eliminar.css    Estilos de la pantalla de eliminación
tests/
  test_base.py          Pruebas de infraestructura y contratos
  test_crear.py         Pruebas de API y recursos del registro
  test_crear_ui.cjs     Pruebas del comportamiento JavaScript
  test_eliminar.py      Pruebas de API, persistencia y recursos
scripts/
  probar_eliminar.py    Prueba manual con dos clientes y SQLite temporal
docs/
  entrega-esteban.md    Evidencias, aporte y pendientes de entrega
```

Los cuatro routers están conectados. Los endpoints de creación y eliminación
están implementados; las demás rutas son el acuerdo para el desarrollo:

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
Al construir o actualizar un modelo desde un esquema, usar
`datos.model_dump(exclude={"codigo_pais"})`: el código fijo pertenece al
contrato de API, no a las columnas del modelo.

`id` es un entero generado por SQLite. Los cuerpos de creación y edición usan
`nombre` (1–100 caracteres), `correo` (correo válido, hasta 254 caracteres) y
`telefono` (entero entre 10000000 y 99999999, exactamente 8 dígitos). El código de
país es fijo para Costa Rica: `codigo_pais` acepta únicamente el número `506`
y es opcional en la solicitud, con ese valor predeterminado. No incluir el
prefijo en `telefono`. Se rechazan teléfonos de texto, decimales, booleanos,
negativos, cero y números de menos o más de 8 dígitos. Al ser entero no conserva ceros
iniciales. Nombre elimina espacios en los extremos; no se aceptan campos
adicionales. `PUT` requiere nombre, correo y teléfono. FastAPI responde con 422
cuando el cuerpo no cumple el esquema.

La interfaz de eliminación solicita confirmación: cancelar no envía `DELETE`.
Coordinar cambios a archivos compartidos antes de
modificarlos. Agregar pruebas por operación en archivos separados y evitar
reescribir la infraestructura para cada funcionalidad.

## Registrar un cliente

Entrar a `/clientes/crear` desde la página inicial. Completar nombre, correo y
teléfono y pulsar **Guardar cliente**. El formulario requiere JavaScript, envía
JSON a `POST /api/clientes` y muestra el identificador después de guardar.

Ejemplo de cuerpo de solicitud, también utilizable desde `/docs`:

```json
{
  "nombre": "Cliente de prueba",
  "correo": "cliente@example.com",
  "telefono": 88888888,
  "codigo_pais": 506
}
```

La API responde con **201** y los mismos campos más `id`. `codigo_pais` siempre
es `506`; se determina por el contrato y no requiere una columna en SQLite.
Los registros se confirman en SQLite antes de responder. Los datos inválidos reciben **422**
con errores en `detail`, conservando el contrato estándar de FastAPI.

El formulario muestra mensajes en español para campos obligatorios, longitudes
máximas y correo inválido, incluidos los errores de validación del servidor.
El campo de teléfono permite solo dígitos y limita la entrada a 8 al escribir
o pegar. No tiene controles de incremento y exige exactamente 8 dígitos, sin
cero inicial, antes de enviar.
Bloquea envíos simultáneos y limpia los campos únicamente después de recibir
una respuesta de registro confirmada. Ante un error, mantiene los datos y
muestra el problema; si se pierde la conexión, verificar si el registro se
guardó antes de reenviar para evitar duplicados. No se exige correo único,
porque el contrato compartido no establece esa restricción.

FastAPI sirve archivos estáticos desde `/static`. Cada integrante puede añadir
su página y su script separados usando estos estilos y el mismo montaje; las
rutas HTML se agregan explícitamente en `app/main.py`.

## Pruebas

```bash
python -m pytest -q
```

Las pruebas usan directorios temporales: comprueban inicio, documentación,
creación del esquema, validaciones, persistencia tras reiniciar y aislamiento
entre ambientes. Las de eliminación verifican 204 sin cuerpo, 404, identificadores
inválidos, persistencia y conservación de otros clientes. No modifican la base
de desarrollo.

### Probar la eliminación de forma aislada

Desde la raíz, con el entorno virtual activo:

```bash
python -m scripts.probar_eliminar
```

Abrir <http://127.0.0.1:8002/clientes/eliminar>. El script crea una base temporal
con los clientes **1** y **2**; no necesita registrar clientes previamente ni
depende de la consulta pendiente. El directorio temporal se elimina al detenerlo con
Ctrl+C y una nueva ejecución vuelve a crear ambos clientes.

1. Ingresar `1` y pulsar **Continuar**. Revisar el identificador del diálogo.
2. Pulsar **Cancelar** (o Escape): debe mostrar cancelación. En la pestaña
   Network del navegador no debe existir una petición `DELETE`.
3. Volver a continuar y pulsar **Sí, eliminar cliente**: debe responder 204
   sin cuerpo y mostrar que el cliente 1 fue eliminado.
4. Repetir con `1`: debe responder 404 e indicar que ya no existe.
5. El cliente `2` debe permanecer. Se puede comprobar directamente en la base
   temporal cuya ruta imprime el script, o mediante la consulta cuando Ney
   integre esa operación.

Para enlazar desde el futuro listado, usar `/clientes/eliminar?cliente_id=ID`.
Este enlace solamente precarga el identificador: siempre requiere confirmación.
La pantalla acepta enteros positivos representables con exactitud por JavaScript;
la API acepta identificadores positivos dentro del rango de enteros de SQLite.

Las capturas y resultados de las comprobaciones realizadas se encuentran en
[la entrega de Esteban](docs/entrega-esteban.md).

Las pruebas de registro comprueban respuesta 201, identificadores, persistencia,
límites, errores 422 sin insertar datos y errores de escritura sin respuesta de
éxito. Para ejecutar las pruebas JavaScript con Node.js 18+ (opcional para
ejecutar la aplicación):

```bash
node --test tests/test_crear_ui.cjs
```

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

El teléfono ahora se almacena como `INTEGER`, con una restricción de 10000000 a
99999999. Las bases de la versión anterior con teléfonos de texto no se
actualizan automáticamente. Antes de usar esta versión con una base existente,
respaldar y migrar los datos, o iniciar una base vacía en otro `APP_DATA_DIR`.
No borrar una base con datos que deban conservarse.

La validación comprueba el formato numérico y el código fijo +506; no verifica
que la línea exista o esté asignada. Se exigen exactamente 8 dígitos.

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
