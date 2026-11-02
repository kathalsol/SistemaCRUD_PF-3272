"use strict";

const formulario = document.getElementById("eliminar-cliente");
const entrada = document.getElementById("cliente-id");
const revisar = document.getElementById("revisar");
const dialogo = document.getElementById("confirmacion");
const cancelar = document.getElementById("cancelar");
const confirmar = document.getElementById("confirmar");
const resultado = document.getElementById("resultado");
let clientePendiente = null;
let enviando = false;

function idValido(valor) {
  return /^[1-9][0-9]*$/.test(valor) && Number.isSafeInteger(Number(valor));
}

function mostrarResultado(mensaje, clase = "") {
  resultado.textContent = mensaje;
  resultado.className = clase;
}

function cancelarEliminacion() {
  if (enviando) return;
  clientePendiente = null;
  dialogo.close();
  mostrarResultado("Eliminación cancelada. No se envió ninguna solicitud de eliminación.");
  revisar.focus();
}

// Permite enlazar esta pantalla desde el futuro listado de clientes.
const idInicial = new URLSearchParams(window.location.search).get("cliente_id");
if (idInicial && idValido(idInicial)) entrada.value = idInicial;

entrada.addEventListener("input", () => entrada.setCustomValidity(""));

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (enviando || dialogo.open) return;
  const id = entrada.value.trim();
  entrada.setCustomValidity(idValido(id) ? "" : "Ingresa un identificador entero positivo válido.");
  if (!formulario.reportValidity()) return;

  clientePendiente = id;
  document.getElementById("id-confirmado").textContent = id;
  mostrarResultado("");
  dialogo.showModal();
  cancelar.focus();
});

cancelar.addEventListener("click", cancelarEliminacion);
dialogo.addEventListener("cancel", (evento) => {
  evento.preventDefault();
  cancelarEliminacion();
});

confirmar.addEventListener("click", async () => {
  if (enviando || clientePendiente === null || !dialogo.open) return;
  const id = clientePendiente;
  enviando = true;
  for (const control of [entrada, revisar, cancelar, confirmar]) control.disabled = true;
  dialogo.setAttribute("aria-busy", "true");
  confirmar.textContent = "Eliminando...";

  try {
    const respuesta = await fetch(`/api/clientes/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (respuesta.status === 204) {
      formulario.reset();
      mostrarResultado(`Cliente ${id} eliminado correctamente.`, "success");
    } else if (respuesta.status === 404) {
      mostrarResultado(`El cliente ${id} no existe o ya fue eliminado.`, "error");
    } else {
      mostrarResultado(
        `No se pudo confirmar la eliminación (error ${respuesta.status}). Verifica el estado del cliente antes de volver a intentarlo.`,
        "error",
      );
    }
  } catch {
    mostrarResultado(
      "No se pudo confirmar la eliminación. Revisa la conexión y el estado del cliente antes de volver a intentarlo.",
      "error",
    );
  } finally {
    clientePendiente = null;
    enviando = false;
    for (const control of [entrada, revisar, cancelar, confirmar]) control.disabled = false;
    dialogo.setAttribute("aria-busy", "false");
    confirmar.textContent = "Sí, eliminar cliente";
    dialogo.close();
    entrada.focus();
  }
});
