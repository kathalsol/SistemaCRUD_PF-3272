# Registro de pase: v0.1.0

**Resultado: simulación local completada y verificada el 2 de noviembre de
2026, entre las 22:52 y las 23:01, hora de Costa Rica (UTC-06:00).**

Se ejecutó una instancia real de FastAPI/Uvicorn y SQLite en un ambiente de
demostración. Se trata de la simulación verificable permitida por la tarea;
no de una publicación en Internet. La instancia se detuvo al terminar.

| Dato | Valor |
| --- | --- |
| Versión autorizada | [v0.1.0](https://github.com/kathalsol/SistemaCRUD_PF-3272/releases/tag/v0.1.0) |
| Commit desplegado | `f4a105e08dadd796757de61961e177f5d0ab35c8` |
| Commit anterior ensayado | `87f549edef3539ac561c9c6c172597f485033f7b` |
| Ambiente y URL durante el ensayo | `demo`, `http://127.0.0.1:8015` |
| Datos | SQLite independiente, únicamente clientes sintéticos |
| Autoriza | Esteban (`Tebansus`), mediante su solicitud de realizar y registrar este ensayo |
| Registro y ejecución | Codex por instrucción de Esteban; no se atribuye ejecución manual a los demás integrantes |
| Estado final | v0.1.0 comprobada nuevamente después de la reversión; servidor detenido |

## Condiciones y autorización

**AUTORIZADO PARA SIMULACIÓN LOCAL**, registrado a las **22:53:28** antes de
iniciar la instancia de v0.1.0. La autorización se limita al ensayo descrito,
con datos sintéticos, base separada y acceso por loopback.

Se verificaron las siguientes condiciones:

- El tag coincidía con el commit integrado en `main`.
- Los PR de funcionalidades e integración tenían aprobación de otra persona:
  #2 por Roberto, #3 y #5 por Katharina, #4 por Ney y #6 por Esteban.
- Las reglas de `main` exigían PR y aprobación.
- Sobre el checkout exacto del tag pasaron **127 pruebas Python y 81 JavaScript**.
  Python produjo una advertencia de obsolescencia de Starlette/HTTPX, sin fallos.
- La instancia anterior se detuvo antes de copiar SQLite; el respaldo tenía
  integridad `ok` y un hash SHA-256 coincidente con el archivo original.
- El código anterior estaba disponible y sus archivos de modelo, esquemas y
  conexión coincidían con los de v0.1.0, permitiendo ensayar esta restauración.

Evidencia: [condiciones previas](evidencias/pase-v0.1.0/condiciones-previas.json),
[autorización](evidencias/pase-v0.1.0/autorizacion.json),
[Python](evidencias/pase-v0.1.0/pytest.txt),
[JavaScript](evidencias/pase-v0.1.0/node.txt) y
[dependencias efectivamente utilizadas](evidencias/pase-v0.1.0/dependencias.txt).

## Secuencia ejecutada

| Momento, Costa Rica | Acción y resultado |
| --- | --- |
| 22:52:36 | Condiciones previas y pruebas del tag verificadas |
| 22:53:23 | Instancia anterior con `environment=demo`; cliente inicial ID 1 creado y consultado |
| 22:53:28 | Instancia detenida, respaldo íntegro y autorización registrada |
| Después de autorizar y antes de 22:53:46 | Inicio de v0.1.0, mismo directorio de datos demo, sin `--reload` |
| 22:53:46 | CRUD por HTTP y conservación del cliente inicial verificados |
| 22:54–22:55 | Páginas disponibles; confirmación, Cancelar y Escape comprobados en navegador |
| Antes de 22:59 | Confirmación en navegador eliminó el cliente sintético ID 3; GET posterior devolvió 404 |
| 22:59:00 | Reinicio de v0.1.0: el cliente ID 2 y todos sus campos persistieron |
| 22:59:55 | Servidor detenido; respaldo anterior restaurado y checksum verificado |
| Después de restaurar | Código anterior iniciado y comprobado con la base restaurada |
| 23:00:38 | Nuevo despliegue de v0.1.0: CRUD completo volvió a pasar |
| 23:01:22 | Cierre del ensayo; puerto 8015 sin servidor escuchando |

El [registro de despliegue](evidencias/pase-v0.1.0/despliegue.json) se generó
después de las primeras comprobaciones; su fecha corresponde al registro,
no al instante de arranque. Las bases y respaldos se ubicaron en un directorio
temporal externo al repositorio, distinto de `data/development.db`.

## Verificación posterior al despliegue

| Comprobación | Resultado |
| --- | --- |
| `/health` | 200; `status=ok`, `environment=demo` |
| Inicio y cuatro pantallas | 200 |
| Crear cliente | 201, ID generado y datos correctos |
| Listar y consultar | 200; registro visible y campos coincidentes |
| Editar y consultar de nuevo | 200; cambios persistidos |
| Eliminar | 204 sin cuerpo |
| Consultar o eliminar el cliente ya eliminado | 404 |
| Otros clientes | Cliente inicial conservado sin cambios |
| Cancelar y Escape en navegador | Sin DELETE durante esas acciones; cliente ID 2 conservado |
| Confirmación en navegador | ID 3 eliminado; consulta posterior 404; IDs 1 y 2 conservados |
| Reiniciar Uvicorn | ID 2 conservó todos sus campos |

Evidencia: [CRUD](evidencias/pase-v0.1.0/posdespliegue.json),
[interfaz](evidencias/pase-v0.1.0/interfaz.json),
[salida HTTP durante cancelación](evidencias/pase-v0.1.0/cancelacion-http.txt),
[persistencia](evidencias/pase-v0.1.0/persistencia.json),
[listado](evidencias/pase-v0.1.0/listado-demo.jpg),
[confirmación](evidencias/pase-v0.1.0/confirmacion-demo.jpg) y
[cancelación](evidencias/pase-v0.1.0/cancelacion-demo.jpg).

## Respaldo y reversión ensayada

Se respaldó `demo.db` con la aplicación detenida. Su SHA-256 fue:

```text
13819436cc746a419e9abc823fd82ce627ada41f97e38e111406820d86fbf94b
```

Antes de restaurar se conservó otro respaldo del estado posterior a las pruebas.
La restauración recuperó exactamente el hash original y dejó solo al cliente
inicial ID 1. El ID 2 creado después del respaldo dejó de existir, como se
esperaba: **restaurar una base descarta los cambios posteriores a ese respaldo**.
Esos datos sintéticos quedaron también en el respaldo posterior.

Se arrancó el commit anterior `87f549e` y se comprobaron salud, listado,
consulta, creación y eliminación. Esa versión precede a la integración de
edición: `PUT` devuelve **405**, resultado esperado y registrado. No se afirma
que el código anterior tuviera las cuatro operaciones. Luego se volvió a
v0.1.0 y se verificó otra vez el CRUD completo.

Evidencia: [respaldo](evidencias/pase-v0.1.0/respaldo.json),
[reversión](evidencias/pase-v0.1.0/reversion.json),
[redespliegue](evidencias/pase-v0.1.0/redespliegue.json) y
[cierre](evidencias/pase-v0.1.0/cierre.json).

## Repetición y alcance de la entrega

El [procedimiento reproducible](procedimiento-pase.md) incluye preparación,
comandos, aprobación, comprobaciones, reversión y pasos automatizables.
`scripts/verificar_demo.py` es una herramienta de comprobación añadida en esta
rama: se ejecutó contra el tag sin modificar su código ni mover `v0.1.0`.

Este registro completa la evidencia del pase local y su autorización. El
documento final de máximo tres páginas y el video de máximo dos minutos siguen
siendo entregables del equipo por integrar.
