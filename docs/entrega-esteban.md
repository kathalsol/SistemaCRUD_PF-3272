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

| Página | Contenido por integrar | Material para integrar |
| --- | --- | --- |
| 1 | Responsables, ramas, commits, PR y revisiones | Enlaces y explicaciones de todos; [revisiones concluidas](evidencias/pase-v0.1.0/condiciones-previas.json) |
| 2 | Conflicto y solución; validación del CRUD | Resolución en PR #5 y [validación del CRUD integrado](pase-v0.1.0.md) |
| 3 | Versión, autorización, despliegue y reversión | Integrar el [pase local ejecutado](pase-v0.1.0.md), su autorización y sus evidencias |

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

## Integración y autorización actualizadas al 2 de noviembre de 2026

- Katharina aprobó el PR #3 de Esteban y el PR #5 de resolución del conflicto
  entre registro y eliminación; ambos quedaron integrados.
- Esteban revisó el PR #6 de Ney, solicitó corregir las consultas simultáneas y
  aprobó la corrección. Ney revisó y aprobó el PR #4 de edición de Roberto.
- El conflicto real y su resolución sin perder funcionalidades están registrados
  en el PR #5.
- La versión integrada se identificó como v0.1.0 y se ejecutó el
  [pase local con pruebas, respaldo, verificación y reversión](pase-v0.1.0.md).
- Las comprobaciones anteriores de este archivo corresponden al aporte original
  de eliminación. El registro del pase contiene los resultados actualizados del
  sistema integrado. La ejecución del ensayo fue asistida por Codex a solicitud
  de Esteban, sin atribuirla a Ney o Roberto.

### Registro de autorización del pase

**Estado: AUTORIZADO PARA SIMULACIÓN LOCAL; ejecución completada y verificada.**
Esteban solicitó realizar y registrar este ensayo. La autorización se registró
el 2 de noviembre de 2026 a las 22:53:28, hora de Costa Rica, después de comprobar
las condiciones y antes del arranque de v0.1.0. El alcance es exclusivamente el
ambiente demo local con datos sintéticos descrito en el registro.

| Campo | Registro |
| --- | --- |
| Versión y SHA verificados en main | v0.1.0, `f4a105e08dadd796757de61961e177f5d0ab35c8` |
| PR aprobados y revisiones | #2, #3, #4, #5 y #6; [condiciones previas](evidencias/pase-v0.1.0/condiciones-previas.json) |
| Pruebas de la versión | 127 Python y 81 JavaScript aprobadas sobre el código del tag |
| Ambiente y procedimiento | Demo en `127.0.0.1:8015`, SQLite independiente; [procedimiento](procedimiento-pase.md) |
| Respaldo y reversión | Respaldo íntegro restaurado y versión anterior comprobada; [evidencia](evidencias/pase-v0.1.0/reversion.json) |
| Autorización | Esteban (`Tebansus`), 2026-11-02 22:53:28 UTC-06:00; [registro](evidencias/pase-v0.1.0/autorizacion.json) |
| Verificación posterior | CRUD, interfaz y reinicio comprobados; [registro completo](pase-v0.1.0.md) |
| Cierre | v0.1.0 comprobada nuevamente tras la reversión; servidor detenido a las 23:01 |
