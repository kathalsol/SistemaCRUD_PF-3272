"use strict";

const formulario = document.getElementById("crear-cliente");
const guardar = document.getElementById("guardar");
const resultado = document.getElementById("resultado");
const campos = ["nombre", "correo", "telefono"];
const limites = { nombre: 100, correo: 254, telefono: 8 };
let enviando = false;

const telefono = document.getElementById("telefono");
telefono.addEventListener("input", () => {
  telefono.value = telefono.value.replace(/[^0-9]/g, "").slice(0, limites.telefono);
});

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
    return "Ingresa un tel\u00e9fono de exactamente 8 d\u00edgitos, sin cero inicial.";
  }
  if (tipo === "string_too_long") {
    return `Usa como m\u00e1ximo ${limites[campo]} caracteres.`;
  }
  if (campo === "correo") {
    return "Ingresa un correo electr\u00f3nico v\u00e1lido.";
  }
  return "Revisa el valor de este campo.";
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (enviando) return;

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

  enviando = true;
  guardar.disabled = true;
  formulario.setAttribute("aria-busy", "true");
  mostrarResultado("Guardando cliente...", "");
  try {
    const respuesta = await fetch("/api/clientes", {
      method: "POST",
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
      mostrarResultado("No se guard\u00f3 el cliente. Revisa los datos ingresados.", "error");
      if (primerError) primerError.focus();
      return;
    }
    if (respuesta.status !== 201) {
      mostrarResultado(
        `El servidor devolvi\u00f3 un error (${respuesta.status}). No se pudo confirmar el registro. Los datos permanecen en el formulario.`,
        "error",
      );
      return;
    }
    const cliente = await respuesta.json();
    if (!Number.isInteger(cliente.id) || cliente.id < 1) {
      throw new Error("Respuesta de registro sin identificador v\u00e1lido.");
    }
    formulario.reset();
    mostrarResultado(`Cliente registrado correctamente. Identificador: ${cliente.id}.`, "success");
  } catch (error) {
    console.error("Error al registrar el cliente:", error);
    mostrarResultado(
      "No se pudo confirmar el registro. Revisa la conexi\u00f3n y verifica si se guard\u00f3 antes de reenviar. Los datos permanecen en el formulario.",
      "error",
    );
  } finally {
    enviando = false;
    guardar.disabled = false;
    formulario.setAttribute("aria-busy", "false");
  }
});
