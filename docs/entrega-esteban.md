# Aporte de Esteban: eliminar clientes

Fecha de comprobación: 1 de noviembre de 2026 (Costa Rica).
Rama: `feature/eliminar-cliente`, creada desde la base `74d73cb` de `dev`.

## Implementación

- `DELETE /api/clientes/{cliente_id}` busca el registro con SQLAlchemy, lo
  elimina y confirma la transacción. Devuelve 204 sin cuerpo o 404 si no existe.
- `/clientes/eliminar` permite ingresar el identificador y revisar un diálogo
  antes de confirmar. Cancelar o Escape no envían `DELETE`. El foco inicial del
  diálogo está en Cancelar; los controles se bloquean mientras se envía la solicitud.
- Los mensajes distinguen eliminación exitosa, registro inexistente y error de
  conexión. Ante un resultado incierto se pide comprobar el registro antes de
  volver a intentar; no se reenvía automáticamente.
- La pantalla no depende del GET pendiente de Ney. Identifica al cliente por
  su ID y admite un enlace desde el listado con `?cliente_id=ID`.

La base `dev` todavía no incluía las rutas de páginas ni los archivos estáticos.
Se agregaron el montaje `/static`, la ruta de esta pantalla y un enlace en el
inicio. El montaje coincide con el de la rama de registro de Katharina.
Al integrar ambas ramas deben conservarse las dos rutas y enlaces, y un solo
montaje `/static`. El modelo, los esquemas y la conexión no se modificaron.

## Validación realizada

`python -m pytest -q`: **31 pruebas aprobadas**, incluidas 11 de eliminación.
Se usan bases temporales. La dependencia Starlette instalada emite una
advertencia de obsolescencia sobre su adaptador HTTPX; no hay pruebas fallidas.
También se comprobó la sintaxis con `node --check app/static/js/eliminar.js`.

Las pruebas de API cubren 204 sin cuerpo, persistencia en una sesión nueva y
después de reiniciar, 404, repetición de la solicitud, conservación de otro
cliente, IDs inválidos, recursos de interfaz y contrato OpenAPI.

La verificación en navegador usó Uvicorn local en el puerto 8012,
`environment=test` y SQLite en un directorio temporal, con dos clientes
sintéticos. Se inspeccionaron el log HTTP del servidor y SQLite después de las
acciones. No se utilizó la base de desarrollo ni se simuló una consulta GET
que aún no existe.

| Comprobación en navegador | Resultado |
| --- | --- |
| Continuar con ID 1 | Diálogo muestra el ID; foco en Cancelar |
| Cancelar | IDs 1 y 2 permanecen; cero solicitudes DELETE |
| Escape | ID 1 permanece; cero solicitudes DELETE |
| Confirmar ID 1 | Una solicitud 204; ID 1 ausente e ID 2 presente |
| Confirmar de nuevo ID 1 | 404 y mensaje de registro inexistente |
| ID fuera del rango exacto de JavaScript | Validación impide abrir el diálogo |
| Enlace con `?cliente_id=2` | Precarga ID 2 sin eliminarlo |
| Detener servidor y confirmar ID 2 | Mensaje de conexión; controles habilitados; ID 2 permanece |

Evidencia: [registro de verificación](evidencias/esteban/verificacion-ui.txt),
[resultado de pytest](evidencias/esteban/pytest.txt),
[confirmación](evidencias/esteban/confirmacion.jpg),
[cancelación](evidencias/esteban/cancelacion.jpg),
[eliminación](evidencias/esteban/eliminado.jpg),
[inexistente](evidencias/esteban/inexistente.jpg) y
[error de conexión](evidencias/esteban/conexion.jpg).

Para repetir la prueba manual, ejecutar `python -m scripts.probar_eliminar`
y seguir los pasos del README. El script utiliza el puerto 8002.

## Explicación para el documento y el video

> Esteban implementó la eliminación de clientes en la API y en la interfaz.
> Antes de borrar se presenta el identificador y se permite confirmar o
> cancelar. La cancelación no envía solicitudes de eliminación. Se verificaron
> el estado 204 sin cuerpo, el error 404, la persistencia y la conservación de
> otros registros mediante pruebas automatizadas y una comprobación en
> navegador con una base temporal.

## Integración del documento final (máximo 3 páginas)

Este archivo es el aporte y registro de Esteban; **no es el documento final
del equipo**. Se prepara con material verificable de los cuatro integrantes.

| Página | Contenido por integrar | Material pendiente |
| --- | --- | --- |
| 1 | Responsables, ramas, commits, PR y revisiones | Enlaces y explicaciones de todos; revisiones concluidas |
| 2 | Conflicto y solución; validación del CRUD | Evidencias del conflicto acordado y validación integrada de Ney |
| 3 | Versión, autorización, despliegue y reversión | Versión/SHA y registros de Roberto; verificación posterior de Ney |

Incorporar las capturas de esta carpeta con pies que identifiquen la prueba;
seleccionar solo las necesarias para respetar el límite de tres páginas.

## Montaje del video (máximo 2 minutos)

| Tiempo | Material y edición |
| --- | --- |
| 0:00–0:25 | Clips de crear, consultar, editar y eliminar; mostrar cancelar y confirmar |
| 0:25–1:00 | Ramas, commits de los cuatro y PR revisados; rótulo con el aporte de cada persona |
| 1:00–1:40 | Pruebas integradas, autorización real y despliegue o simulación identificada |
| 1:40–2:00 | Protección de main y aprendizaje del equipo |

Pendientes los clips/explicaciones de todos. Las capturas de Esteban ya están
disponibles. No se ha editado ni publicado un video final. Antes de entregar,
revisar duración, legibilidad y acceso de la docente al enlace.

## Revisión y autorización pendientes

- Katharina es la revisora asignada al PR de Esteban hacia `dev`.
- Esteban debe revisar el PR de edición de Roberto y probarlo antes de aprobar.
  En la consulta inicial del repositorio ese PR aún no estaba disponible.
- La evidencia de conflicto requiere dos aportaciones acordadas. No se ha
  provocado ni atribuido un conflicto inexistente.
- La validación completa, las protecciones, la integración en `main`, la versión
  verificada y el respaldo no se acreditan con estas pruebas individuales.

### Registro de autorización del pase

**Estado: PENDIENTE; pase no autorizado.** Completar únicamente cuando se
cumplan las condiciones del plan del equipo.

| Campo | Valor por registrar |
| --- | --- |
| Versión y SHA verificados en main | Pendiente de Roberto y Ney |
| PR aprobados y revisiones | Pendientes de integración |
| Resultado de validación integral y enlace | Pendiente de Ney |
| Ambiente y procedimiento de despliegue | Pendiente de Roberto |
| Respaldo previo y procedimiento de reversión comprobado | Pendiente de Roberto |
| Autorización, responsable y fecha/hora de Costa Rica | Pendiente de Esteban tras verificar las condiciones |
| Comprobación posterior al despliegue | Pendiente de Ney tras el pase |
