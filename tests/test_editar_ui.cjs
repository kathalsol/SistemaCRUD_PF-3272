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

async function preparar(fetch, search = "") {
  const elementos = {};
  for (const id of [
    "cargar-cliente", "cliente-id", "cliente-id-error", "cargar", "editar-cliente",
    "datos-cliente", "guardar", "resultado", "nombre", "correo", "telefono",
    "nombre-error", "correo-error", "telefono-error",
  ]) {
    elementos[id] = crearElemento();
  }
  elementos["datos-cliente"].disabled = true;
  const peticiones = [];
  vm.runInNewContext(script, {
    console: { error() {} },
    document: { getElementById: (id) => elementos[id] },
    fetch: async (url, opciones = {}) => {
      peticiones.push({ url, metodo: opciones.method ?? "GET", cuerpo: opciones.body });
      return fetch(url, opciones);
    },
    URLSearchParams,
    AbortController,
    window: { location: { search } },
  });
  await esperar();
  const ui = {
    elementos,
    peticiones,
    async cargar(id) {
      elementos["cliente-id"].value = id;
      elementos["cargar-cliente"].listeners.submit({ preventDefault() {} });
      await esperar();
    },
    escribirId(id) {
      elementos["cliente-id"].value = id;
      elementos["cliente-id"].listeners.input();
    },
    guardar: () => elementos["editar-cliente"].listeners.submit({ preventDefault() {} }),
  };
  return ui;
}

const ana = {
  id: 1, nombre: "Ana", correo: "ana@example.com", telefono: 88887777, codigo_pais: 506,
};

test("carga el cliente indicado en la URL y habilita el formulario", async () => {
  const { elementos, peticiones } = await preparar(
    () => respuesta(200, ana), "?cliente_id=1",
  );

  assert.deepEqual(peticiones.map((p) => p.url), ["/api/clientes/1"]);
  assert.equal(elementos["cliente-id"].value, "1");
  assert.equal(elementos["datos-cliente"].disabled, false);
  assert.equal(elementos.nombre.value, "Ana");
  assert.equal(elementos.telefono.value, "88887777");
});

test("el formulario empieza bloqueado y no guarda sin cliente cargado", async () => {
  const ui = await preparar(() => assert.fail("No debe llamar a la API"));

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  await ui.guardar();
  assert.deepEqual(ui.peticiones, []);
});

test("guarda en el cliente cargado con JSON normalizado", async () => {
  const ui = await preparar((url, opciones) => {
    if (opciones.method !== "PUT") return respuesta(200, ana);
    return respuesta(200, { ...ana, nombre: "Ana María" });
  });
  await ui.cargar("1");
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
  assert.equal(ui.elementos.guardar.disabled, false);
});

test("cambiar el identificador sin cargar no permite sobrescribir otro cliente", async () => {
  const ui = await preparar(() => respuesta(200, ana));
  await ui.cargar("1");
  ui.escribirId("2");

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.equal(ui.elementos.nombre.value, "");
  await ui.guardar();
  assert.deepEqual(ui.peticiones.map((p) => p.metodo), ["GET"]);
  assert.match(ui.elementos.resultado.textContent, /Pulsa Cargar/);
});

test("muestra errores de validación del servidor en español bajo cada campo", async () => {
  const ui = await preparar((url, opciones) => {
    if (opciones.method !== "PUT") return respuesta(200, ana);
    return respuesta(422, {
      detail: [
        { loc: ["body", "nombre"], type: "string_too_short", msg: "String should have at least 1 character" },
        { loc: ["body", "correo"], type: "value_error", msg: "value is not a valid email address" },
      ],
    });
  });
  await ui.cargar("1");
  await ui.guardar();

  assert.equal(ui.elementos["nombre-error"].textContent, "Este campo es obligatorio.");
  assert.equal(ui.elementos["correo-error"].textContent, "Ingresa un correo electrónico válido.");
  assert.equal(ui.elementos.nombre.attributes["aria-invalid"], "true");
  assert.equal(ui.elementos.resultado.textContent, "No se guardaron los cambios. Revisa los datos ingresados.");
});

test("valida campos en la pantalla antes de enviar", async () => {
  const ui = await preparar(() => respuesta(200, ana));
  await ui.cargar("1");
  ui.elementos.nombre.value = "   ";
  ui.elementos.telefono.value = "0888777";
  await ui.guardar();

  assert.equal(ui.peticiones.length, 1);
  assert.equal(ui.elementos["nombre-error"].textContent, "Este campo es obligatorio.");
  assert.match(ui.elementos["telefono-error"].textContent, /exactamente 8 dígitos/);
  assert.equal(ui.elementos.nombre.focused, true);
});

test("un 500 sin JSON al guardar informa el error del servidor", async () => {
  const ui = await preparar((url, opciones) => (
    opciones.method === "PUT" ? respuesta(500) : respuesta(200, ana)
  ));
  await ui.cargar("1");
  await ui.guardar();

  assert.match(ui.elementos.resultado.textContent, /El servidor devolvió un error \(500\)/);
  assert.equal(ui.elementos.nombre.value, "Ana");
  assert.equal(ui.elementos["cliente-id"].disabled, false);
});

test("un 404 al guardar bloquea el formulario", async () => {
  const ui = await preparar((url, opciones) => (
    opciones.method === "PUT" ? respuesta(404, { detail: "Cliente no encontrado" }) : respuesta(200, ana)
  ));
  await ui.cargar("1");
  await ui.guardar();

  assert.equal(ui.elementos["datos-cliente"].disabled, true);
  assert.match(ui.elementos.resultado.textContent, /ya no existe/);
});

test("informa cuando no se puede cargar por falta de conexión", async () => {
  const ui = await preparar(() => { throw new TypeError("Failed to fetch"); });
  await ui.cargar("1");

  assert.equal(ui.elementos.resultado.textContent, "No se pudo cargar el cliente. Revisa la conexión.");
  assert.equal(ui.elementos["datos-cliente"].disabled, true);
});

test("informa cuando el cliente no existe", async () => {
  const ui = await preparar(() => respuesta(404, { detail: "Cliente no encontrado" }));
  await ui.cargar("7");

  assert.equal(ui.elementos.resultado.textContent, "No existe un cliente con identificador 7.");
  assert.equal(ui.elementos["datos-cliente"].disabled, true);
});

test("rechaza identificadores inválidos sin llamar a la API", async () => {
  const ui = await preparar(() => assert.fail("No debe llamar a la API"));
  for (const id of ["1.5", "1e3", "0", "-1", "abc", "9007199254740993"]) {
    await ui.cargar(id);
    assert.equal(ui.elementos["cliente-id-error"].textContent, "Ingresa un identificador entero positivo.");
  }
  await ui.cargar("  ");
  assert.equal(ui.elementos["cliente-id-error"].textContent, "Este campo es obligatorio.");
  assert.deepEqual(ui.peticiones, []);
});

test("una carga anterior que responde tarde no reemplaza la vigente", async () => {
  const pendientes = {};
  const ui = await preparar((url) => new Promise((resolver) => { pendientes[url] = resolver; }));
  await ui.cargar("1");
  await ui.cargar("2");
  pendientes["/api/clientes/2"](respuesta(200, { ...ana, id: 2, nombre: "Luis" }));
  await esperar();
  pendientes["/api/clientes/1"](respuesta(200, ana));
  await esperar();

  assert.equal(ui.elementos.nombre.value, "Luis");
  ui.elementos.nombre.value = "Luis Mora";
  ui.guardar();
  assert.equal(ui.peticiones.at(-1).url, "/api/clientes/2");
});

test("el teléfono descarta letras y conserva solo ocho dígitos", async () => {
  const ui = await preparar(() => respuesta(200, ana));
  ui.elementos.telefono.value = "8a8b-8877 77 99";
  ui.elementos.telefono.listeners.input();

  assert.equal(ui.elementos.telefono.value, "88887777");
});
