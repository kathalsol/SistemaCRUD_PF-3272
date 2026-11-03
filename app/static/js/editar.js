"use strict";

const formularioCarga = document.getElementById("cargar-cliente");
const entradaId = document.getElementById("cliente-id");
const cargar = document.getElementById("cargar");
const formulario = document.getElementById("editar-cliente");
const datosCliente = document.getElementById("datos-cliente");
const guardar = document.getElementById("guardar");
const resultado = document.getElementById("resultado");
const campos = ["nombre", "correo", "telefono"];
const limites = { nombre: 100, correo: 254, telefono: 8 };

// Identificador del cliente cuyos datos están en el formulario. Guardar usa
// siempre este valor, nunca el texto actual del campo de identificador.
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
      mostrarResultado(`No existe un cliente con identificador ${id}.`, "error");
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

// Cambiar el identificador invalida el cliente cargado: hay que volver a cargar.
entradaId.addEventListener("input", () => {
  mostrarError("cliente-id", "");
  if (idCargado === null && controladorConsulta === null) return;
  descartarConsultaPendiente();
  descartarCliente();
  mostrarResultado("Pulsa Cargar para editar el cliente con este identificador.", "");
});

formularioCarga.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (enviando) return;
  entradaId.value = entradaId.value.trim();
  if (!entradaId.value) {
    mostrarError("cliente-id", "Este campo es obligatorio.");
  } else if (!idValido(entradaId.value)) {
    mostrarError("cliente-id", "Ingresa un identificador entero positivo.");
  } else {
    mostrarError("cliente-id", "");
    cargarCliente(entradaId.value);
    return;
  }
  descartarConsultaPendiente();
  descartarCliente();
  mostrarResultado("", "");
  entradaId.focus();
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
  entradaId.disabled = true;
  cargar.disabled = true;
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
    mostrarResultado(`Cliente ${id} actualizado correctamente.`, "success");
  } catch (error) {
    console.error("Error al editar el cliente:", error);
    mostrarResultado(
      "No se pudo confirmar la edición. Revisa la conexión y vuelve a cargar el cliente para verificar si se guardó. Los datos permanecen en el formulario.",
      "error",
    );
  } finally {
    enviando = false;
    guardar.disabled = false;
    entradaId.disabled = false;
    cargar.disabled = false;
    formulario.setAttribute("aria-busy", "false");
  }
});

// Permite enlazar directamente a la edición: /clientes/editar?cliente_id=ID
const idInicial = new URLSearchParams(window.location.search).get("cliente_id");
if (idInicial && idValido(idInicial)) {
  entradaId.value = idInicial;
  cargarCliente(idInicial);
}
