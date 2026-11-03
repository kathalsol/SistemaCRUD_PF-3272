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
    value: "",
    textContent: "",
    className: "",
    disabled: false,
    attributes: {},
    listeners: {},
    validity: { typeMismatch: false },
    addEventListener(evento, handler) { this.listeners[evento] = handler; },
    setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
    focus() { this.focused = true; },
  };
}

function crearSelector() {
  const selector = crearElemento();
  selector.disabled = true;
  selector.children = [];
  Object.defineProperty(selector, "options", { get() { return this.children; } });
  selector.replaceChildren = (...opciones) => {
    selector.children = opciones;
    for (const opcion of opciones) opcion.padre = selector;
  };
  return selector;
}

function crearOpcion() {
  return {
    value: "",
    textContent: "",
    remove() { this.padre.children = this.padre.children.filter((o) => o !== this); },
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

// Responde el listado y la consulta de cada cliente; `put` atiende las ediciones.
function api({ listado = [ana, luis], put } = {}) {
  return (url, opciones) => {
    if (opciones.method === "PUT") return put(url, opciones);
    if (url === "/api/clientes") return respuesta(200, listado);
    const cliente = listado.find((c) => url === `/api/clientes/${c.id}`);
    return cliente ? respuesta(200, cliente) : respuesta(404, { detail: "Cliente no encontrado" });
  };
}

async function preparar(fetch, search = "") {
  const elementos = { "cliente-id": crearSelector() };
  for (const id of [
    "editar-cliente", "datos-cliente", "guardar", "resultado", "nombre", "correo",
    "telefono", "nombre-error", "correo-error", "telefono-error",
  ]) {
    elementos[id] = crearElemento();
  }
  elementos["datos-cliente"].disabled = true;
  const peticiones = [];
  vm.runInNewContext(script, {
    console: { error() {} },
    document: {
      getElementById: (id) => elementos[id],
      createElement: (etiqueta) => {
        assert.equal(etiqueta, "option");
        return crearOpcion();
      },
    },
    fetch: async (url, opciones = {}) => {
      peticiones.push({ url, metodo: opciones.method ?? "GET", cuerpo: opciones.body });
      return fetch(url, opciones);
    },
    URLSearchParams,
    AbortController,
    window: { location: { search } },
  });
  await esperar();
  const selector = elementos["cliente-id"];
  return {
    elementos,
    peticiones,
    selector,
    opciones: () => selector.children.map((o) => [o.value, o.textContent]),
    async elegir(id) {
      selector.value = id;
      selector.listeners.change();
      await esperar();
    },
    guardar: () => elementos["editar-cliente"].listeners.submit({ preventDefault() {} }),
  };
}

test("llena la lista con los clientes registrados", async () => {
  const ui = await preparar(api());

  assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes"]);
  assert.deepEqual(ui.opciones(), [
    ["", "Selecciona un cliente"], ["1", "1 - Ana"], ["2", "2 - Luis"],
  ]);
  assert.equal(ui.selector.disabled, false);
  assert.equal(ui.elementos["datos-cliente"].disabled, true);
});

test("indica cuando no hay clientes para editar", async () => {
  const ui = await preparar(api({ listado: [] }));

  assert.deepEqual(ui.opciones(), [["", "No hay clientes registrados"]]);
  assert.equal(ui.selector.disabled, true);
  assert.equal(ui.elementos.resultado.textContent, "No hay clientes registrados para editar.");
});

test("informa cuando no se puede cargar la lista", async () => {
  const ui = await preparar(() => { throw new TypeError("Failed to fetch"); });

  assert.equal(ui.selector.disabled, true);
  assert.equal(ui.elementos.resultado.className, "error");
  assert.match(ui.elementos.resultado.textContent, /No se pudo cargar la lista de clientes/);
});

test("selecciona y carga el cliente indicado en la URL", async () => {
  const ui = await preparar(api(), "?cliente_id=2");

  assert.equal(ui.selector.value, "2");
  assert.deepEqual(ui.peticiones.map((p) => p.url), ["/api/clientes", "/api/clientes/2"]);
  assert.equal(ui.elementos["datos-cliente"].disabled, false);
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

test("guarda en el cliente cargado y actualiza su nombre en la lista", async () => {
  const ui = await preparar(api({
    put: () => respuesta(200, { ...ana, nombre: "Ana María" }),
  }));
  await ui.elegir("1");
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
  assert.deepEqual(ui.opciones()[1], ["1", "1 - Ana María"]);
  assert.equal(ui.selector.disabled, false);
});

test("al elegir otro cliente se reemplazan los datos y se guarda en ese cliente", async () => {
  const ui = await preparar(api({ put: () => respuesta(200, luis) }));
  await ui.elegir("1");
  ui.elementos.nombre.value = "Cambio sin guardar";
  await ui.elegir("2");

  assert.equal(ui.elementos.nombre.value, "Luis");
  await ui.guardar();
  const put = ui.peticiones.at(-1);
  assert.equal(put.url, "/api/clientes/2");
  assert.equal(JSON.parse(put.cuerpo).nombre, "Luis");
});

test("volver a la opción vacía bloquea el formulario", async () => {
  const ui = await preparar(api({ put: () => assert.fail("No debe enviar PUT") }));
  await ui.elegir("1");
  await ui.elegir("");

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.equal(ui.elementos.nombre.value, "");
  await ui.guardar();
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
  await ui.elegir("1");
  await ui.guardar();

  assert.equal(ui.elementos["nombre-error"].textContent, "Este campo es obligatorio.");
  assert.equal(ui.elementos["correo-error"].textContent, "Ingresa un correo electrónico válido.");
  assert.equal(ui.elementos.nombre.attributes["aria-invalid"], "true");
  assert.equal(ui.elementos.resultado.textContent, "No se guardaron los cambios. Revisa los datos ingresados.");
});

test("valida campos en la pantalla antes de enviar", async () => {
  const ui = await preparar(api({ put: () => assert.fail("No debe enviar PUT") }));
  await ui.elegir("1");
  ui.elementos.nombre.value = "   ";
  ui.elementos.telefono.value = "0888777";
  await ui.guardar();

  assert.equal(ui.elementos["nombre-error"].textContent, "Este campo es obligatorio.");
  assert.match(ui.elementos["telefono-error"].textContent, /exactamente 8 dígitos/);
  assert.equal(ui.elementos.nombre.focused, true);
});

test("un 500 sin JSON al guardar informa el error del servidor", async () => {
  const ui = await preparar(api({ put: () => respuesta(500) }));
  await ui.elegir("1");
  await ui.guardar();

  assert.match(ui.elementos.resultado.textContent, /El servidor devolvió un error \(500\)/);
  assert.equal(ui.elementos.nombre.value, "Ana");
  assert.equal(ui.selector.disabled, false);
});

test("un 404 al guardar quita el cliente de la lista y bloquea el formulario", async () => {
  const ui = await preparar(api({ put: () => respuesta(404, { detail: "Cliente no encontrado" }) }));
  await ui.elegir("1");
  await ui.guardar();

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.equal(ui.selector.value, "");
  assert.deepEqual(ui.opciones().map(([valor]) => valor), ["", "2"]);
  assert.match(ui.elementos.resultado.textContent, /ya no existe/);
});

test("un cliente eliminado después de cargar la lista se quita al elegirlo", async () => {
  const listado = [ana, luis];
  const ui = await preparar(api({ listado }));
  listado.pop();
  await ui.elegir("2");

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.deepEqual(ui.opciones().map(([valor]) => valor), ["", "1"]);
  assert.equal(ui.elementos.resultado.textContent, "El cliente 2 ya no existe.");
});

test("informa cuando no se puede cargar el cliente por falta de conexión", async () => {
  const ui = await preparar((url) => {
    if (url === "/api/clientes") return respuesta(200, [ana]);
    throw new TypeError("Failed to fetch");
  });
  await ui.elegir("1");

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
  await ui.elegir("1");
  await ui.elegir("2");
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
