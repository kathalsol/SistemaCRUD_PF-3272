const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "../app/static/js/consultar.js"), "utf8",
);

function crearElemento(etiqueta = "") {
  return {
    etiqueta,
    value: "",
    textContent: "",
    className: "",
    href: "",
    hidden: false,
    disabled: false,
    children: [],
    attributes: {},
    listeners: {},
    addEventListener(evento, handler) { this.listeners[evento] = handler; },
    setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
    append(...hijos) { this.children.push(...hijos); },
    replaceChildren(...hijos) { this.children = hijos; },
    focus() { this.focused = true; },
  };
}

function respuesta(status, cuerpo) {
  return { status, json: async () => cuerpo };
}

async function preparar(fetch, search = "") {
  const elementos = {};
  for (const id of [
    "buscar-cliente", "cliente-id", "cliente-id-error", "resultado", "detalle",
    "detalle-id", "detalle-nombre", "detalle-correo", "detalle-telefono",
    "detalle-eliminar", "actualizar", "estado-listado", "tabla-clientes", "filas-clientes",
  ]) {
    elementos[id] = crearElemento();
  }
  elementos.detalle.hidden = true;
  const peticiones = [];
  vm.runInNewContext(script, {
    console: { error() {} },
    document: {
      getElementById: (id) => elementos[id],
      createElement: crearElemento,
    },
    fetch: async (url) => {
      peticiones.push(url);
      return fetch(url);
    },
    URLSearchParams,
    window: { location: { search } },
  });
  await new Promise((resolver) => setImmediate(resolver));
  return { elementos, peticiones };
}

const ana = {
  id: 1, nombre: "<b>Ana</b>", correo: "ana@example.com", telefono: 88887777, codigo_pais: 506,
};

test("lista clientes como texto, con teléfono formateado y enlace a eliminar", async () => {
  const { elementos, peticiones } = await preparar(() => respuesta(200, [ana]));

  assert.deepEqual(peticiones, ["/api/clientes"]);
  assert.equal(elementos["tabla-clientes"].hidden, false);
  assert.equal(elementos["estado-listado"].textContent, "Clientes registrados: 1.");
  const [fila] = elementos["filas-clientes"].children;
  const celdas = fila.children.map((celda) => celda.textContent);
  assert.deepEqual(celdas.slice(0, 4), [1, "<b>Ana</b>", "ana@example.com", "+506 8888-7777"]);
  const [, eliminar] = fila.children[4].children[0].children;
  assert.equal(eliminar.href, "/clientes/eliminar?cliente_id=1");
});

test("indica cuando no hay clientes registrados", async () => {
  const { elementos } = await preparar(() => respuesta(200, []));

  assert.equal(elementos["tabla-clientes"].hidden, true);
  assert.equal(elementos["estado-listado"].textContent, "No hay clientes registrados.");
});

test("muestra error si no se puede cargar el listado", async () => {
  const { elementos } = await preparar(() => { throw new Error("sin conexión"); });

  assert.equal(elementos["tabla-clientes"].hidden, true);
  assert.equal(elementos["estado-listado"].className, "error");
  assert.equal(elementos.actualizar.disabled, false);
});

test("consulta por identificador y muestra el detalle", async () => {
  const { elementos, peticiones } = await preparar(
    (url) => respuesta(200, url === "/api/clientes" ? [] : ana),
  );
  elementos["cliente-id"].value = " 1 ";
  elementos["buscar-cliente"].listeners.submit({ preventDefault() {} });
  await new Promise((resolver) => setImmediate(resolver));

  assert.equal(peticiones.at(-1), "/api/clientes/1");
  assert.equal(elementos.detalle.hidden, false);
  assert.equal(elementos["detalle-nombre"].textContent, "<b>Ana</b>");
  assert.equal(elementos["detalle-telefono"].textContent, "+506 8888-7777");
  assert.equal(elementos["detalle-eliminar"].href, "/clientes/eliminar?cliente_id=1");
});

test("informa cuando el cliente no existe", async () => {
  const { elementos } = await preparar(
    (url) => (url === "/api/clientes" ? respuesta(200, []) : respuesta(404, {})),
  );
  elementos["cliente-id"].value = "99";
  elementos["buscar-cliente"].listeners.submit({ preventDefault() {} });
  await new Promise((resolver) => setImmediate(resolver));

  assert.equal(elementos.detalle.hidden, true);
  assert.equal(elementos.resultado.textContent, "No existe un cliente con identificador 99.");
  assert.equal(elementos.resultado.className, "error");
});

for (const valor of ["", "abc", "0", "-1", "1.5", "9007199254740993"]) {
  test(`no consulta con identificador inválido: "${valor}"`, async () => {
    const { elementos, peticiones } = await preparar(() => respuesta(200, []));
    elementos["cliente-id"].value = valor;
    elementos["buscar-cliente"].listeners.submit({ preventDefault() {} });

    assert.deepEqual(peticiones, ["/api/clientes"]);
    assert.notEqual(elementos["cliente-id-error"].textContent, "");
    assert.equal(elementos["cliente-id"].attributes["aria-invalid"], "true");
  });
}

test("carga el detalle desde ?cliente_id=ID", async () => {
  const { elementos, peticiones } = await preparar(
    (url) => respuesta(200, url === "/api/clientes" ? [] : ana), "?cliente_id=1",
  );

  assert.ok(peticiones.includes("/api/clientes/1"));
  assert.equal(elementos.detalle.hidden, false);
});
