const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "../app/static/js/editar.js"), "utf8",
);

function crearElemento() {
  return {
    id: "",
    value: "",
    textContent: "",
    className: "",
    placeholder: "",
    disabled: false,
    hidden: false,
    children: [],
    attributes: {},
    listeners: {},
    validity: { typeMismatch: false },
    addEventListener(evento, handler) { this.listeners[evento] = handler; },
    setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
    append(...hijos) { this.children.push(...hijos); },
    replaceChildren(...hijos) { this.children = hijos; },
    focus() { this.focused = true; },
  };
}

function respuesta(status, cuerpo) {
  return {
    status,
    json: async () => {
      if (cuerpo === undefined) throw new SyntaxError("Cuerpo sin JSON");
      return cuerpo;
    },
  };
}

const esperar = () => new Promise((resolver) => setImmediate(resolver));

const ana = {
  id: 1, nombre: "Ana", correo: "ana@example.com", telefono: 88887777, codigo_pais: 506,
};
const luis = {
  id: 2, nombre: "Luis", correo: "luis@example.com", telefono: 66665555, codigo_pais: 506,
};
const jose = {
  id: 12, nombre: "José Vargas", correo: "jvargas@correo.cr", telefono: 71456789, codigo_pais: 506,
};

// Responde el listado y la consulta de cada cliente; `put` atiende las ediciones.
function api({ listado = [ana, luis], put } = {}) {
  return (url, opciones) => {
    if (opciones.method === "PUT") return put(url, opciones);
    if (url === "/api/clientes") return respuesta(200, [...listado]);
    const cliente = listado.find((c) => url === `/api/clientes/${c.id}`);
    return cliente ? respuesta(200, cliente) : respuesta(404, { detail: "Cliente no encontrado" });
  };
}

async function preparar(fetch, search = "") {
  const elementos = {};
  for (const id of [
    "cliente-buscar", "lista-clientes", "editar-cliente", "datos-cliente", "datos-titulo",
    "guardar", "resultado", "nombre", "correo", "telefono",
    "nombre-error", "correo-error", "telefono-error",
  ]) {
    elementos[id] = crearElemento();
  }
  elementos["cliente-buscar"].disabled = true;
  elementos["lista-clientes"].hidden = true;
  elementos["datos-cliente"].disabled = true;
  elementos["cliente-buscar"].select = function () { this.seleccionado = true; };
  const peticiones = [];
  const documento = {
    activeElement: null,
    getElementById: (id) => elementos[id],
    createElement: crearElemento,
  };
  vm.runInNewContext(script, {
    console: { error() {} },
    document: documento,
    fetch: async (url, opciones = {}) => {
      peticiones.push({ url, metodo: opciones.method ?? "GET", cuerpo: opciones.body });
      return fetch(url, opciones);
    },
    URLSearchParams,
    AbortController,
    window: { location: { search } },
  });
  await esperar();
  const buscador = elementos["cliente-buscar"];
  const lista = elementos["lista-clientes"];
  const ui = {
    elementos,
    documento,
    peticiones,
    buscador,
    lista,
    // Nombre y detalle de cada sugerencia, o el texto si no hay coincidencias.
    sugerencias: () => lista.children.map((li) => (
      li.children.length ? `${li.children[0].textContent} | ${li.children[1].textContent}` : li.textContent
    )),
    resaltada: () => lista.children.findIndex((li) => li.attributes["aria-selected"] === "true"),
    enfocar: () => buscador.listeners.focus(),
    salir: () => buscador.listeners.blur(),
    escribir(texto) {
      buscador.value = texto;
      buscador.listeners.input();
    },
    async tecla(key) {
      buscador.listeners.keydown({ key, preventDefault() {} });
      await esperar();
    },
    async clic(indice) {
      lista.children[indice].listeners.mousedown({ preventDefault() {} });
      await esperar();
    },
    async elegir(id) {
      ui.enfocar();
      await ui.clic(lista.children.findIndex((li) => li.id === `sugerencia-${id}`));
    },
    guardar: () => elementos["editar-cliente"].listeners.submit({ preventDefault() {} }),
  };
  return ui;
}

test("habilita el buscador al cargar la lista y muestra todos al entrar", async () => {
  const ui = await preparar(api());

  assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes"]);
  assert.equal(ui.buscador.disabled, false);
  assert.equal(ui.lista.hidden, true);
  ui.enfocar();
  assert.equal(ui.lista.hidden, false);
  assert.equal(ui.buscador.attributes["aria-expanded"], "true");
  assert.deepEqual(ui.sugerencias(), [
    "Ana | ID 1 · ana@example.com", "Luis | ID 2 · luis@example.com",
  ]);
  assert.equal(ui.elementos["datos-cliente"].disabled, true);
});

test("indica cuando no hay clientes para editar", async () => {
  const ui = await preparar(api({ listado: [] }));

  assert.equal(ui.buscador.disabled, true);
  assert.equal(ui.buscador.placeholder, "No hay clientes registrados");
  assert.equal(ui.elementos.resultado.textContent, "No hay clientes registrados para editar.");
});

test("informa cuando no se puede cargar la lista", async () => {
  const ui = await preparar(() => { throw new TypeError("Failed to fetch"); });

  assert.equal(ui.buscador.disabled, true);
  assert.equal(ui.elementos.resultado.className, "error");
  assert.match(ui.elementos.resultado.textContent, /No se pudo cargar la lista de clientes/);
});

test("escribir filtra por nombre sin distinguir mayúsculas ni tildes", async () => {
  const ui = await preparar(api({ listado: [ana, luis, jose] }));
  ui.escribir("  JOSE ");

  assert.deepEqual(ui.sugerencias(), ["José Vargas | ID 12 · jvargas@correo.cr"]);
  assert.equal(ui.resaltada(), 0);
  assert.equal(ui.buscador.attributes["aria-activedescendant"], "sugerencia-12");
});

test("escribir filtra por identificador o correo e indica si no hay coincidencias", async () => {
  const ui = await preparar(api({ listado: [ana, luis, jose] }));
  ui.escribir("12");
  assert.deepEqual(ui.sugerencias(), ["José Vargas | ID 12 · jvargas@correo.cr"]);

  ui.escribir("correo.cr");
  assert.deepEqual(ui.sugerencias(), ["José Vargas | ID 12 · jvargas@correo.cr"]);

  ui.escribir("zzz");
  assert.deepEqual(ui.sugerencias(), ["Sin coincidencias"]);
  await ui.tecla("Enter");
  assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes"]);
});

test("un clic en una sugerencia carga ese cliente", async () => {
  const ui = await preparar(api({ listado: [ana, luis, jose] }));
  ui.escribir("vargas");
  await ui.clic(0);

  assert.equal(ui.lista.hidden, true);
  assert.equal(ui.buscador.value, "12 - José Vargas");
  assert.equal(ui.peticiones.at(-1).url, "/api/clientes/12");
  assert.equal(ui.elementos.nombre.value, "José Vargas");
  assert.equal(ui.elementos["datos-cliente"].disabled, false);
  assert.equal(ui.elementos["datos-titulo"].textContent, "Datos de 12 - José Vargas");
});

test("las flechas mueven el resaltado y Enter carga el cliente resaltado", async () => {
  const ui = await preparar(api({ listado: [ana, luis, jose] }));
  await ui.tecla("ArrowDown");
  assert.equal(ui.lista.hidden, false);
  assert.equal(ui.resaltada(), 0);

  await ui.tecla("ArrowDown");
  await ui.tecla("ArrowDown");
  await ui.tecla("ArrowDown");
  assert.equal(ui.resaltada(), 2);
  await ui.tecla("ArrowUp");
  assert.equal(ui.resaltada(), 1);
  await ui.tecla("Enter");

  assert.equal(ui.peticiones.at(-1).url, "/api/clientes/2");
  assert.equal(ui.elementos.nombre.value, "Luis");
});

test("Escape cierra la lista sin cargar nada", async () => {
  const ui = await preparar(api());
  ui.escribir("an");
  await ui.tecla("Escape");

  assert.equal(ui.lista.hidden, true);
  assert.equal(ui.buscador.attributes["aria-expanded"], "false");
  await ui.tecla("Enter");
  assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes"]);
});

test("al salir sin elegir, el campo vuelve a mostrar el cliente que se edita", async () => {
  const ui = await preparar(api());
  await ui.elegir(1);
  ui.escribir("lu");
  ui.salir();

  assert.equal(ui.lista.hidden, true);
  assert.equal(ui.buscador.value, "1 - Ana");
  assert.equal(ui.elementos.nombre.value, "Ana");
});

test("un clic con el campo enfocado reabre la lista y selecciona el texto", async () => {
  const ui = await preparar(api());
  await ui.elegir(2);
  ui.buscador.seleccionado = false;
  ui.documento.activeElement = ui.buscador;
  let cancelado = false;
  ui.buscador.listeners.mousedown({ preventDefault() { cancelado = true; } });

  assert.equal(cancelado, true);
  assert.equal(ui.buscador.seleccionado, true);
  assert.equal(ui.lista.hidden, false);
  assert.equal(ui.sugerencias().length, 2);
});

test("un clic sin foco deja que el navegador enfoque el campo", async () => {
  const ui = await preparar(api());
  let cancelado = false;
  ui.buscador.listeners.mousedown({ preventDefault() { cancelado = true; } });

  assert.equal(cancelado, false);
  assert.equal(ui.lista.hidden, true);
});

test("selecciona y carga el cliente indicado en la URL", async () => {
  const ui = await preparar(api(), "?cliente_id=2");

  assert.equal(ui.buscador.value, "2 - Luis");
  assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes", "/api/clientes/2"]);
  assert.equal(ui.elementos.nombre.value, "Luis");
  assert.equal(ui.elementos.telefono.value, "66665555");
});

test("un identificador de la URL que no está en la lista no se carga", async () => {
  for (const search of ["?cliente_id=9", "?cliente_id=1.5"]) {
    const ui = await preparar(api(), search);
    assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes"]);
    assert.equal(ui.elementos["datos-cliente"].disabled, true);
  }
});

test("el formulario empieza bloqueado y no guarda sin cliente cargado", async () => {
  const ui = await preparar(api({ put: () => assert.fail("No debe enviar PUT") }));

  await ui.guardar();
  assert.deepEqual(ui.peticiones.map((p) => p.metodo), ["GET"]);
});

test("guarda en el cliente cargado aunque se escriba otra búsqueda", async () => {
  const ui = await preparar(api({
    put: () => respuesta(200, { ...ana, nombre: "Ana María" }),
  }));
  await ui.elegir(1);
  ui.escribir("lu");
  ui.elementos.nombre.value = "  Ana María  ";
  await ui.guardar();

  const put = ui.peticiones.at(-1);
  assert.equal(put.url, "/api/clientes/1");
  assert.equal(put.metodo, "PUT");
  assert.deepEqual(JSON.parse(put.cuerpo), {
    nombre: "Ana María", correo: "ana@example.com", telefono: 88887777, codigo_pais: 506,
  });
  assert.equal(ui.elementos.resultado.textContent, "Cliente 1 actualizado correctamente.");
  assert.equal(ui.elementos.resultado.className, "success");
  assert.equal(ui.buscador.value, "1 - Ana María");
  assert.equal(ui.elementos["datos-titulo"].textContent, "Datos de 1 - Ana María");
  assert.equal(ui.buscador.disabled, false);
  ui.escribir("maría");
  assert.deepEqual(ui.sugerencias(), ["Ana María | ID 1 · ana@example.com"]);
});

test("al elegir otro cliente se reemplazan los datos y se guarda en ese cliente", async () => {
  const ui = await preparar(api({ put: () => respuesta(200, luis) }));
  await ui.elegir(1);
  ui.elementos.nombre.value = "Cambio sin guardar";
  await ui.elegir(2);

  assert.equal(ui.elementos.nombre.value, "Luis");
  await ui.guardar();
  const put = ui.peticiones.at(-1);
  assert.equal(put.url, "/api/clientes/2");
  assert.equal(JSON.parse(put.cuerpo).nombre, "Luis");
});

test("muestra errores de validación del servidor en español bajo cada campo", async () => {
  const ui = await preparar(api({
    put: () => respuesta(422, {
      detail: [
        { loc: ["body", "nombre"], type: "string_too_short", msg: "String should have at least 1 character" },
        { loc: ["body", "correo"], type: "value_error", msg: "value is not a valid email address" },
      ],
    }),
  }));
  await ui.elegir(1);
  await ui.guardar();

  assert.equal(ui.elementos["nombre-error"].textContent, "Este campo es obligatorio.");
  assert.equal(ui.elementos["correo-error"].textContent, "Ingresa un correo electrónico válido.");
  assert.equal(ui.elementos.nombre.attributes["aria-invalid"], "true");
  assert.equal(ui.elementos.resultado.textContent, "No se guardaron los cambios. Revisa los datos ingresados.");
});

test("valida campos en la pantalla antes de enviar", async () => {
  const ui = await preparar(api({ put: () => assert.fail("No debe enviar PUT") }));
  await ui.elegir(1);
  ui.elementos.nombre.value = "   ";
  ui.elementos.telefono.value = "0888777";
  await ui.guardar();

  assert.equal(ui.elementos["nombre-error"].textContent, "Este campo es obligatorio.");
  assert.match(ui.elementos["telefono-error"].textContent, /exactamente 8 dígitos/);
  assert.equal(ui.elementos.nombre.focused, true);
});

test("un 500 sin JSON al guardar informa el error del servidor", async () => {
  const ui = await preparar(api({ put: () => respuesta(500) }));
  await ui.elegir(1);
  await ui.guardar();

  assert.match(ui.elementos.resultado.textContent, /El servidor devolvió un error \(500\)/);
  assert.equal(ui.elementos.nombre.value, "Ana");
  assert.equal(ui.buscador.disabled, false);
});

test("un 404 al guardar quita el cliente de las sugerencias y bloquea el formulario", async () => {
  const ui = await preparar(api({ put: () => respuesta(404, { detail: "Cliente no encontrado" }) }));
  await ui.elegir(1);
  await ui.guardar();

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.equal(ui.buscador.value, "");
  assert.match(ui.elementos.resultado.textContent, /ya no existe/);
  ui.enfocar();
  assert.deepEqual(ui.sugerencias(), ["Luis | ID 2 · luis@example.com"]);
});

test("un cliente eliminado después de cargar la lista se quita al elegirlo", async () => {
  const listado = [ana, luis];
  const ui = await preparar(api({ listado }));
  listado.pop();
  await ui.elegir(2);

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.equal(ui.elementos.resultado.textContent, "El cliente 2 ya no existe.");
  ui.enfocar();
  assert.deepEqual(ui.sugerencias(), ["Ana | ID 1 · ana@example.com"]);
});

test("informa cuando no se puede cargar el cliente por falta de conexión", async () => {
  const ui = await preparar((url) => {
    if (url === "/api/clientes") return respuesta(200, [ana]);
    throw new TypeError("Failed to fetch");
  });
  await ui.elegir(1);

  assert.equal(ui.elementos.resultado.textContent, "No se pudo cargar el cliente. Revisa la conexión.");
  assert.equal(ui.elementos["datos-cliente"].disabled, true);
});

test("una carga anterior que responde tarde no reemplaza la vigente", async () => {
  const pendientes = {};
  const ui = await preparar((url) => (
    url === "/api/clientes"
      ? respuesta(200, [ana, luis])
      : new Promise((resolver) => { pendientes[url] = resolver; })
  ));
  await ui.elegir(1);
  await ui.elegir(2);
  pendientes["/api/clientes/2"](respuesta(200, luis));
  await esperar();
  pendientes["/api/clientes/1"](respuesta(200, ana));
  await esperar();

  assert.equal(ui.elementos.nombre.value, "Luis");
  ui.guardar();
  assert.equal(ui.peticiones.at(-1).url, "/api/clientes/2");
});

test("el teléfono descarta letras y conserva solo ocho dígitos", async () => {
  const ui = await preparar(api());
  ui.elementos.telefono.value = "8a8b-8877 77 99";
  ui.elementos.telefono.listeners.input();

  assert.equal(ui.elementos.telefono.value, "88887777");
});
