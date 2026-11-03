"use strict";

const selector = document.getElementById("cliente-id");
const formulario = document.getElementById("editar-cliente");
const datosCliente = document.getElementById("datos-cliente");
const guardar = document.getElementById("guardar");
const resultado = document.getElementById("resultado");
const campos = ["nombre", "correo", "telefono"];
const limites = { nombre: 100, correo: 254, telefono: 8 };

// Identificador del cliente cuyos datos están en el formulario. Guardar usa
// siempre este valor, nunca la opción seleccionada en ese momento.
let idCargado = null;
let enviando = false;

const telefono = document.getElementById("telefono");
telefono.addEventListener("input", () => {
  telefono.value = telefono.value.replace(/[^0-9]/g, "").slice(0, limites.telefono);
});

function idValido(valor) {
  return /^[1-9][0-9]*$/.test(valor) && Number.isSafeInteger(Number(valor));
}

function mostrarResultado(mensaje, clase) {
  resultado.textContent = mensaje;
  resultado.className = clase;
}

function mostrarError(campo, mensaje) {
  document.getElementById(`${campo}-error`).textContent = mensaje;
  document.getElementById(campo).setAttribute("aria-invalid", mensaje ? "true" : "false");
}

function mensajeValidacion(campo, tipo) {
  if (tipo === "missing" || tipo === "string_too_short") {
    return "Este campo es obligatorio.";
  }
  if (campo === "telefono") {
    return "Ingresa un teléfono de exactamente 8 dígitos, sin cero inicial.";
  }
  if (tipo === "string_too_long") {
    return `Usa como máximo ${limites[campo]} caracteres.`;
  }
  if (campo === "correo") {
    return "Ingresa un correo electrónico válido.";
  }
  return "Revisa el valor de este campo.";
}

// Vacía y bloquea el formulario hasta que se cargue un cliente.
function descartarCliente() {
  idCargado = null;
  datosCliente.disabled = true;
  for (const campo of campos) {
    document.getElementById(campo).value = "";
    mostrarError(campo, "");
  }
}

// Solo la carga más reciente puede llenar el formulario: las respuestas
// anteriores que lleguen fuera de orden se descartan y su petición se cancela.
let consultaVigente = 0;
let controladorConsulta = null;

function descartarConsultaPendiente() {
  consultaVigente += 1;
  if (controladorConsulta) controladorConsulta.abort();
  controladorConsulta = null;
}

async function cargarCliente(id) {
  descartarConsultaPendiente();
  descartarCliente();
  const consulta = consultaVigente;
  const controlador = new AbortController();
  controladorConsulta = controlador;
  mostrarResultado("Cargando cliente...", "");
  try {
    const respuesta = await fetch(
      `/api/clientes/${encodeURIComponent(id)}`, { signal: controlador.signal },
    );
    const cliente = respuesta.status === 200 ? await respuesta.json() : null;
    if (consulta !== consultaVigente) return;
    if (cliente) {
      for (const campo of campos) {
        document.getElementById(campo).value = String(cliente[campo]);
      }
      idCargado = id;
      datosCliente.disabled = false;
      mostrarResultado(`Cliente ${id} cargado. Modifica los datos y pulsa Guardar cambios.`, "");
    } else if (respuesta.status === 404) {
      // Otro usuario lo eliminó después de cargar la lista.
      opcionDe(id)?.remove();
      selector.value = "";
      mostrarResultado(`El cliente ${id} ya no existe.`, "error");
    } else {
      mostrarResultado(`El servidor devolvió un error (${respuesta.status}). No se pudo cargar el cliente.`, "error");
    }
  } catch (error) {
    if (consulta !== consultaVigente) return;
    console.error("Error al cargar el cliente:", error);
    mostrarResultado("No se pudo cargar el cliente. Revisa la conexión.", "error");
  } finally {
    if (consulta === consultaVigente) controladorConsulta = null;
  }
}

function crearOpcion(valor, texto) {
  const opcion = document.createElement("option");
  opcion.value = valor;
  opcion.textContent = texto;
  return opcion;
}

function textoOpcion(cliente) {
  return `${cliente.id} - ${cliente.nombre}`;
}

function opcionDe(id) {
  return [...selector.options].find((opcion) => opcion.value === id);
}

// Llena la lista con los clientes registrados, ordenados por identificador.
async function cargarListado(idInicial) {
  try {
    const respuesta = await fetch("/api/clientes");
    if (respuesta.status !== 200) {
      throw new Error(`Respuesta inesperada del listado: ${respuesta.status}`);
    }
    const clientes = await respuesta.json();
    if (clientes.length === 0) {
      selector.replaceChildren(crearOpcion("", "No hay clientes registrados"));
      mostrarResultado("No hay clientes registrados para editar.", "");
      return;
    }
    selector.replaceChildren(
      crearOpcion("", "Selecciona un cliente"),
      ...clientes.map((cliente) => crearOpcion(String(cliente.id), textoOpcion(cliente))),
    );
    selector.disabled = false;
    if (idInicial && opcionDe(idInicial)) {
      selector.value = idInicial;
      cargarCliente(idInicial);
    } else if (idInicial) {
      mostrarResultado(`No existe un cliente con identificador ${idInicial}.`, "error");
    }
  } catch (error) {
    console.error("Error al cargar la lista de clientes:", error);
    selector.replaceChildren(crearOpcion("", "Lista no disponible"));
    mostrarResultado("No se pudo cargar la lista de clientes. Revisa la conexi\u00f3n y recarga la p\u00e1gina.", "error");
  }
}

// Elegir otro cliente descarta el cargado y trae los datos del nuevo.
selector.addEventListener("change", () => {
  if (selector.value) {
    cargarCliente(selector.value);
    return;
  }
  descartarConsultaPendiente();
  descartarCliente();
  mostrarResultado("", "");
});

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (enviando || idCargado === null) return;

  mostrarResultado("", "");
  const datos = {};
  let primerError = null;
  for (const campo of campos) {
    const entrada = document.getElementById(campo);
    entrada.value = entrada.value.trim();
    datos[campo] = entrada.value;
    let mensaje = "";
    if (!entrada.value) {
      mensaje = mensajeValidacion(campo, "missing");
    } else if (campo === "telefono" &&
      !/^[1-9][0-9]{7}$/.test(entrada.value)) {
      mensaje = mensajeValidacion(campo, "value_error");
    } else if (entrada.value.length > limites[campo]) {
      mensaje = mensajeValidacion(campo, "string_too_long");
    } else if (campo === "correo" && entrada.validity.typeMismatch) {
      mensaje = mensajeValidacion(campo, "value_error");
    }
    mostrarError(campo, mensaje);
    if (mensaje && !primerError) primerError = entrada;
  }
  if (primerError) {
    mostrarResultado("Revisa los campos indicados antes de guardar.", "error");
    primerError.focus();
    return;
  }
  datos.telefono = Number(datos.telefono);
  datos.codigo_pais = 506;

  const id = idCargado;
  enviando = true;
  guardar.disabled = true;
  selector.disabled = true;
  formulario.setAttribute("aria-busy", "true");
  mostrarResultado("Guardando cambios...", "");
  try {
    const respuesta = await fetch(`/api/clientes/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (respuesta.status === 422) {
      const errores = await respuesta.json();
      if (Array.isArray(errores.detail)) {
        for (const error of errores.detail) {
          const campo = error.loc?.[0] === "body" ? error.loc[1] : null;
          if (campos.includes(campo)) {
            mostrarError(campo, mensajeValidacion(campo, error.type));
            if (!primerError) primerError = document.getElementById(campo);
          }
        }
      }
      mostrarResultado("No se guardaron los cambios. Revisa los datos ingresados.", "error");
      if (primerError) primerError.focus();
      return;
    }
    if (respuesta.status === 404) {
      descartarCliente();
      opcionDe(id)?.remove();
      selector.value = "";
      mostrarResultado(`El cliente ${id} ya no existe. No se guardaron los cambios.`, "error");
      return;
    }
    if (respuesta.status !== 200) {
      mostrarResultado(
        `El servidor devolvió un error (${respuesta.status}). No se pudo confirmar la edición. Los datos permanecen en el formulario.`,
        "error",
      );
      return;
    }
    const cliente = await respuesta.json();
    for (const campo of campos) {
      document.getElementById(campo).value = String(cliente[campo]);
    }
    const opcion = opcionDe(id);
    if (opcion) opcion.textContent = textoOpcion({ id, nombre: cliente.nombre });
    mostrarResultado(`Cliente ${id} actualizado correctamente.`, "success");
  } catch (error) {
    console.error("Error al editar el cliente:", error);
    mostrarResultado(
      "No se pudo confirmar la edición. Revisa la conexión y vuelve a seleccionar el cliente para verificar si se guardó. Los datos permanecen en el formulario.",
      "error",
    );
  } finally {
    enviando = false;
    guardar.disabled = false;
    selector.disabled = false;
    formulario.setAttribute("aria-busy", "false");
  }
});

// Permite enlazar directamente a la edición: /clientes/editar?cliente_id=ID
const idInicial = new URLSearchParams(window.location.search).get("cliente_id");
cargarListado(idInicial && idValido(idInicial) ? idInicial : null);
