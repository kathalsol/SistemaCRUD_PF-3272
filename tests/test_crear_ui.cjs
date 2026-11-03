const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const script = fs.readFileSync(
  path.join(__dirname, "../app/static/js/crear.js"), "utf8",
);

function preparar(fetch) {
  const elementos = {};
  let submit;
  const errores = [];
  for (const id of [
    "crear-cliente", "guardar", "resultado", "nombre", "correo", "telefono",
    "nombre-error", "correo-error", "telefono-error",
  ]) {
    elementos[id] = {
      value: "",
      textContent: "",
      className: "",
      disabled: false,
      attributes: {},
      listeners: {},
      addEventListener(evento, handler) { this.listeners[evento] = handler; },
      validity: { typeMismatch: false },
      setAttribute(nombre, valor) { this.attributes[nombre] = valor; },
      focus() { this.focused = true; },
    };
  }
  elementos.nombre.value = "Cliente";
  elementos.correo.value = "cliente@example.com";
  elementos.telefono.value = "12345678";
  elementos["crear-cliente"].addEventListener = (evento, handler) => {
    assert.equal(evento, "submit");
    submit = handler;
  };
  elementos["crear-cliente"].reset = () => {
    for (const campo of ["nombre", "correo", "telefono"]) {
      elementos[campo].value = "";
    }
  };
  vm.runInNewContext(script, {
    document: { getElementById: (id) => elementos[id] },
    fetch,
    console: { error: (...args) => errores.push(args) },
  });
  return {
    elementos,
    errores,
    enviar: () => submit({ preventDefault() {} }),
  };
}

test("envia JSON normalizado, muestra identificador y limpia al guardar", async () => {
  let solicitudes = 0;
  const ui = preparar(async (url, options) => {
    solicitudes++;
    assert.equal(url, "/api/clientes");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(options.body), {
      nombre: "Cliente", correo: "cliente@example.com", telefono: 12345678, codigo_pais: 506,
    });
    assert.equal(ui.elementos.guardar.disabled, true);
    return { status: 201, json: async () => ({ id: 15 }) };
  });
  ui.elementos.nombre.value = "  Cliente  ";
  await ui.enviar();
  assert.equal(solicitudes, 1);
  assert.match(ui.elementos.resultado.textContent, /Identificador: 15/);
  assert.equal(ui.elementos.resultado.className, "success");
  assert.equal(ui.elementos.nombre.value, "");
  assert.equal(ui.elementos.guardar.disabled, false);
  assert.equal(ui.elementos["crear-cliente"].attributes["aria-busy"], "false");
});

test("al escribir un noveno digito conserva solo los primeros ocho", () => {
  const ui = preparar(() => assert.fail("Escribir no debe enviar una solicitud"));
  ui.elementos.telefono.value = "123456789";
  ui.elementos.telefono.listeners.input();
  assert.equal(ui.elementos.telefono.value, "12345678");
});

test("al pegar un telefono largo limita el campo a ocho digitos", () => {
  const ui = preparar(() => assert.fail("Pegar no debe enviar una solicitud"));
  ui.elementos.telefono.value = "888888881234";
  ui.elementos.telefono.listeners.input();
  assert.equal(ui.elementos.telefono.value, "88888888");
});

test("el limite no modifica valores de hasta ocho digitos", () => {
  const ui = preparar(() => assert.fail("Escribir no debe enviar una solicitud"));
  for (const valor of ["", "1", "1234567", "88888888"]) {
    ui.elementos.telefono.value = valor;
    ui.elementos.telefono.listeners.input();
    assert.equal(ui.elementos.telefono.value, valor);
  }
});

test("el campo elimina caracteres que no sean digitos", () => {
  const ui = preparar(() => assert.fail("Escribir no debe enviar una solicitud"));
  ui.elementos.telefono.value = "abc12-34 5678";
  ui.elementos.telefono.listeners.input();
  assert.equal(ui.elementos.telefono.value, "12345678");
});

for (const campo of ["nombre", "correo", "telefono"]) {
  test(`campo obligatorio ${campo} bloquea envio`, async () => {
    const ui = preparar(() => assert.fail("No debe enviar datos invalidos"));
    ui.elementos[campo].value = "   ";
    await ui.enviar();
    assert.match(ui.elementos[`${campo}-error`].textContent, /obligatorio/);
    assert.equal(ui.elementos[campo].attributes["aria-invalid"], "true");
    assert.equal(ui.elementos[campo].focused, true);
  });
}

test("correo invalido bloquea envio", async () => {
  const ui = preparar(() => assert.fail("No debe enviar un correo invalido"));
  ui.elementos.correo.value = "invalido";
  ui.elementos.correo.validity.typeMismatch = true;
  await ui.enviar();
  assert.match(ui.elementos["correo-error"].textContent, /correo electr/);
});

for (const [campo, maximo] of [["nombre", 100], ["correo", 254], ["telefono", 8]]) {
  test(`longitud maxima de ${campo}`, async () => {
    const ui = preparar(() => assert.fail("No debe enviar un campo demasiado largo"));
    ui.elementos[campo].value = "a".repeat(maximo + 1);
    await ui.enviar();
    assert.match(ui.elementos[`${campo}-error`].textContent, new RegExp(`${maximo}`));
  });
}

test("422 muestra errores del servidor y conserva los datos", async () => {
  const ui = preparar(async () => ({
    status: 422,
    json: async () => ({
      detail: [
        { loc: ["body", "correo"], type: "value_error", msg: "Invalid email" },
        { loc: ["body", "telefono"], type: "string_too_short" },
      ],
    }),
  }));
  await ui.enviar();
  assert.match(ui.elementos["correo-error"].textContent, /correo electr/);
  assert.match(ui.elementos["telefono-error"].textContent, /obligatorio/);
  assert.equal(ui.elementos.correo.focused, true);
  assert.equal(ui.elementos.nombre.value, "Cliente");
  assert.equal(ui.elementos.resultado.className, "error");
  assert.equal(ui.elementos.guardar.disabled, false);
});

for (const telefono of ["1", "12", "123", "1234", "12345", "123456", "1234567", "01234567", "123abc", "8888-8888", "+50688888888", "888888888", "1.5", "-123", "0", "00000000", "1e7", "123 456"]) {
  test(`telefono invalido ${telefono} bloquea envio`, async () => {
    const ui = preparar(() => assert.fail("No debe enviar un telefono invalido"));
    ui.elementos.telefono.value = telefono;
    await ui.enviar();
    assert.match(ui.elementos["telefono-error"].textContent, /8 d/);
    assert.equal(ui.elementos.telefono.attributes["aria-invalid"], "true");
  });
}

for (const telefono of ["10000000", "12345678", "88888888", "99999999"]) {
  test(`telefono valido ${telefono} se envia como numero con codigo fijo`, async () => {
    const ui = preparar(async (url, options) => {
      const datos = JSON.parse(options.body);
      assert.equal(datos.telefono, Number(telefono));
      assert.equal(datos.codigo_pais, 506);
      return { status: 201, json: async () => ({ id: 1 }) };
    });
    ui.elementos.telefono.value = telefono;
    await ui.enviar();
    assert.equal(ui.elementos.resultado.className, "success");
  });
}

test("error numerico del servidor muestra mensaje de telefono", async () => {
  const ui = preparar(async () => ({
    status: 422,
    json: async () => ({ detail: [{ loc: ["body", "telefono"], type: "less_than_equal" }] }),
  }));
  await ui.enviar();
  assert.match(ui.elementos["telefono-error"].textContent, /8 d/);
  assert.equal(ui.elementos.telefono.value, "12345678");
});

test("un error general 422 no se presenta como exito", async () => {
  const ui = preparar(async () => ({
    status: 422,
    json: async () => ({ detail: [{ loc: ["body"], type: "model_type" }] }),
  }));
  await ui.enviar();
  assert.equal(ui.elementos.resultado.className, "error");
  assert.equal(ui.elementos.nombre.value, "Cliente");
});

test("error del servidor conserva datos y permite un nuevo intento", async () => {
  let solicitudes = 0;
  const ui = preparar(async () => {
    solicitudes++;
    return solicitudes === 1
      ? { status: 500 }
      : { status: 201, json: async () => ({ id: 2 }) };
  });
  await ui.enviar();
  assert.match(ui.elementos.resultado.textContent, /500/);
  assert.equal(ui.elementos.nombre.value, "Cliente");
  assert.equal(ui.elementos.guardar.disabled, false);
  await ui.enviar();
  assert.equal(ui.elementos.resultado.className, "success");
});

test("fallo de conexion avisa de resultado incierto y no reintenta", async () => {
  let solicitudes = 0;
  const ui = preparar(async () => {
    solicitudes++;
    throw new Error("Sin conexion");
  });
  await ui.enviar();
  assert.equal(solicitudes, 1);
  assert.equal(ui.errores.length, 1);
  assert.match(ui.elementos.resultado.textContent, /antes de reenviar/);
  assert.equal(ui.elementos.nombre.value, "Cliente");
  assert.equal(ui.elementos.guardar.disabled, false);
});

test("respuesta de exito malformada no limpia los campos", async () => {
  const ui = preparar(async () => ({ status: 201, json: async () => ({}) }));
  await ui.enviar();
  assert.equal(ui.elementos.resultado.className, "error");
  assert.equal(ui.elementos.nombre.value, "Cliente");
  assert.equal(ui.errores.length, 1);
});

test("doble submit mientras guarda produce una sola solicitud", async () => {
  let terminar;
  let solicitudes = 0;
  const ui = preparar(() => {
    solicitudes++;
    return new Promise((resolve) => { terminar = resolve; });
  });
  const primera = ui.enviar();
  await ui.enviar();
  assert.equal(solicitudes, 1);
  assert.equal(ui.elementos.guardar.disabled, true);
  terminar({ status: 201, json: async () => ({ id: 1 }) });
  await primera;
  assert.equal(ui.elementos.guardar.disabled, false);
});

test("corregir un campo limpia el error del intento anterior", async () => {
  const ui = preparar(async () => ({ status: 201, json: async () => ({ id: 1 }) }));
  ui.elementos.nombre.value = "";
  await ui.enviar();
  assert.equal(ui.elementos.nombre.attributes["aria-invalid"], "true");
  ui.elementos.nombre.value = "Cliente";
  await ui.enviar();
  assert.equal(ui.elementos["nombre-error"].textContent, "");
  assert.equal(ui.elementos.nombre.attributes["aria-invalid"], "false");
});
