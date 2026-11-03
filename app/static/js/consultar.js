"use strict";

const formulario = document.getElementById("buscar-cliente");
const entrada = document.getElementById("cliente-id");
const resultado = document.getElementById("resultado");
const detalle = document.getElementById("detalle");
const actualizar = document.getElementById("actualizar");
const estadoListado = document.getElementById("estado-listado");
const tabla = document.getElementById("tabla-clientes");
const filas = document.getElementById("filas-clientes");

function idValido(valor) {
  return /^[1-9][0-9]*$/.test(valor) && Number.isSafeInteger(Number(valor));
}

// 88888888 con codigo_pais 506 se muestra como +506 8888-8888.
function formatearTelefono(cliente) {
  const numero = String(cliente.telefono);
  return `+${cliente.codigo_pais} ${numero.slice(0, 4)}-${numero.slice(4)}`;
}

function enlaceEliminar(id) {
  return `/clientes/eliminar?cliente_id=${encodeURIComponent(id)}`;
}

function mostrarResultado(mensaje, clase) {
  resultado.textContent = mensaje;
  resultado.className = clase;
}

function mostrarError(mensaje) {
  document.getElementById("cliente-id-error").textContent = mensaje;
  entrada.setAttribute("aria-invalid", mensaje ? "true" : "false");
}

function mostrarDetalle(cliente) {
  document.getElementById("detalle-id").textContent = cliente.id;
  document.getElementById("detalle-nombre").textContent = cliente.nombre;
  document.getElementById("detalle-correo").textContent = cliente.correo;
  document.getElementById("detalle-telefono").textContent = formatearTelefono(cliente);
  document.getElementById("detalle-eliminar").href = enlaceEliminar(cliente.id);
  detalle.hidden = false;
}

async function consultarCliente(id) {
  detalle.hidden = true;
  mostrarResultado("Consultando cliente...", "");
  try {
    const respuesta = await fetch(`/api/clientes/${encodeURIComponent(id)}`);
    if (respuesta.status === 200) {
      mostrarDetalle(await respuesta.json());
      mostrarResultado("", "");
    } else if (respuesta.status === 404) {
      mostrarResultado(`No existe un cliente con identificador ${id}.`, "error");
    } else {
      mostrarResultado(`El servidor devolvió un error (${respuesta.status}). No se pudo consultar el cliente.`, "error");
    }
  } catch (error) {
    console.error("Error al consultar el cliente:", error);
    mostrarResultado("No se pudo consultar el cliente. Revisa la conexión.", "error");
  }
}

function crearCelda(texto) {
  const celda = document.createElement("td");
  celda.textContent = texto;
  return celda;
}

function crearFila(cliente) {
  const fila = document.createElement("tr");
  fila.append(
    crearCelda(cliente.id),
    crearCelda(cliente.nombre),
    crearCelda(cliente.correo),
    crearCelda(formatearTelefono(cliente)),
  );

  const ver = document.createElement("button");
  ver.type = "button";
  ver.className = "link";
  ver.textContent = "Ver detalle";
  ver.setAttribute("aria-label", `Ver detalle del cliente ${cliente.id}`);
  ver.addEventListener("click", () => {
    entrada.value = String(cliente.id);
    mostrarError("");
    consultarCliente(String(cliente.id));
  });

  const eliminar = document.createElement("a");
  eliminar.href = enlaceEliminar(cliente.id);
  eliminar.textContent = "Eliminar";
  eliminar.setAttribute("aria-label", `Eliminar el cliente ${cliente.id}`);

  const acciones = document.createElement("td");
  const contenedor = document.createElement("div");
  contenedor.className = "actions";
  contenedor.append(ver, eliminar);
  acciones.append(contenedor);
  fila.append(acciones);
  return fila;
}

async function cargarListado() {
  actualizar.disabled = true;
  estadoListado.textContent = "Cargando clientes...";
  estadoListado.className = "";
  try {
    const respuesta = await fetch("/api/clientes");
    if (respuesta.status !== 200) {
      throw new Error(`Respuesta inesperada del listado: ${respuesta.status}`);
    }
    const clientes = await respuesta.json();
    filas.replaceChildren(...clientes.map(crearFila));
    tabla.hidden = clientes.length === 0;
    estadoListado.textContent = clientes.length === 0
      ? "No hay clientes registrados."
      : `Clientes registrados: ${clientes.length}.`;
  } catch (error) {
    console.error("Error al cargar el listado:", error);
    tabla.hidden = true;
    estadoListado.textContent = "No se pudo cargar el listado de clientes. Revisa la conexión.";
    estadoListado.className = "error";
  } finally {
    actualizar.disabled = false;
  }
}

entrada.addEventListener("input", () => mostrarError(""));

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();
  entrada.value = entrada.value.trim();
  if (!entrada.value) {
    mostrarError("Este campo es obligatorio.");
  } else if (!idValido(entrada.value)) {
    mostrarError("Ingresa un identificador entero positivo.");
  } else {
    mostrarError("");
    consultarCliente(entrada.value);
    return;
  }
  detalle.hidden = true;
  mostrarResultado("", "");
  entrada.focus();
});

actualizar.addEventListener("click", cargarListado);

// Permite enlazar directamente al detalle: /clientes/consultar?cliente_id=ID
const idInicial = new URLSearchParams(window.location.search).get("cliente_id");
if (idInicial && idValido(idInicial)) {
  entrada.value = idInicial;
  consultarCliente(idInicial);
}

cargarListado();
