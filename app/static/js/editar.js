"use strict";

const buscador = document.getElementById("cliente-buscar");
const lista = document.getElementById("lista-clientes");
const formulario = document.getElementById("editar-cliente");
const datosCliente = document.getElementById("datos-cliente");
const tituloDatos = document.getElementById("datos-titulo");
const guardar = document.getElementById("guardar");
const resultado = document.getElementById("resultado");
const campos = ["nombre", "correo", "telefono"];
const limites = { nombre: 100, correo: 254, telefono: 8 };

// Identificador del cliente cuyos datos están en el formulario. Guardar usa
// siempre este valor, nunca el texto escrito en el buscador en ese momento.
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
  tituloDatos.textContent = "Datos del cliente";
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
      tituloDatos.textContent = `Datos de ${textoOpcion({ id, nombre: cliente.nombre })}`;
      mostrarResultado(`Cliente ${id} cargado. Modifica los datos y pulsa Guardar cambios.`, "");
    } else if (respuesta.status === 404) {
      // Otro usuario lo eliminó después de cargar la lista.
      quitarCliente(id);
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

function textoOpcion(cliente) {
  return `${cliente.id} - ${cliente.nombre}`;
}

// Clientes del listado, ordenados por identificador.
let clientes = [];
// Clientes que se muestran en la lista de sugerencias y el resaltado.
let visibles = [];
let activo = -1;

// Compara sin distinguir mayúsculas ni tildes: "jose" encuentra "José".
function normalizar(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Busca por identificador, nombre o correo. Con `todos` muestra la lista completa.
function coincidencias(todos = false) {
  const termino = normalizar(buscador.value.trim());
  if (todos || !termino) return clientes;
  return clientes.filter((cliente) => normalizar(
    `${cliente.id} ${cliente.nombre} ${cliente.correo}`,
  ).includes(termino));
}

function crearSugerencia(cliente, indice) {
  const opcion = document.createElement("li");
  opcion.id = `sugerencia-${cliente.id}`;
  opcion.setAttribute("role", "option");
  const nombre = document.createElement("span");
  nombre.textContent = cliente.nombre;
  const detalle = document.createElement("small");
  detalle.textContent = `ID ${cliente.id} · ${cliente.correo}`;
  opcion.append(nombre, detalle);
  // mousedown en lugar de click: evita que el campo pierda el foco y cierre la lista.
  opcion.addEventListener("mousedown", (evento) => {
    evento.preventDefault();
    elegirCliente(cliente);
  });
  opcion.addEventListener("mousemove", () => resaltar(indice));
  return opcion;
}

function resaltar(indice) {
  activo = indice;
  [...lista.children].forEach((opcion, i) => {
    opcion.className = i === activo ? "activa" : "";
    opcion.setAttribute("aria-selected", i === activo ? "true" : "false");
  });
  const opcion = lista.children[activo];
  buscador.setAttribute("aria-activedescendant", opcion?.id ?? "");
  opcion?.scrollIntoView?.({ block: "nearest" });
}

function abrirLista(todos = false) {
  visibles = coincidencias(todos);
  if (visibles.length === 0) {
    const vacio = document.createElement("li");
    vacio.className = "vacia";
    vacio.textContent = "Sin coincidencias";
    vacio.addEventListener("mousedown", (evento) => evento.preventDefault());
    lista.replaceChildren(vacio);
    activo = -1;
    buscador.setAttribute("aria-activedescendant", "");
  } else {
    lista.replaceChildren(...visibles.map(crearSugerencia));
    resaltar(0);
  }
  lista.hidden = false;
  buscador.setAttribute("aria-expanded", "true");
}

function cerrarLista() {
  lista.hidden = true;
  activo = -1;
  buscador.setAttribute("aria-expanded", "false");
  buscador.setAttribute("aria-activedescendant", "");
}

// Muestra el cliente elegido en el campo y carga sus datos si es otro.
function elegirCliente(cliente) {
  buscador.value = textoOpcion(cliente);
  // Queda seleccionado para que al escribir otra búsqueda se reemplace.
  buscador.select?.();
  cerrarLista();
  if (String(cliente.id) !== idCargado) cargarCliente(String(cliente.id));
}

function quitarCliente(id) {
  clientes = clientes.filter((cliente) => String(cliente.id) !== id);
  buscador.value = "";
}

// Carga los clientes registrados para sugerirlos al escribir.
async function cargarListado(idInicial) {
  try {
    const respuesta = await fetch("/api/clientes");
    if (respuesta.status !== 200) {
      throw new Error(`Respuesta inesperada del listado: ${respuesta.status}`);
    }
    clientes = await respuesta.json();
    if (clientes.length === 0) {
      buscador.placeholder = "No hay clientes registrados";
      mostrarResultado("No hay clientes registrados para editar.", "");
      return;
    }
    buscador.placeholder = "Escribe un nombre, correo o identificador";
    buscador.disabled = false;
    const inicial = clientes.find((cliente) => String(cliente.id) === idInicial);
    if (inicial) {
      elegirCliente(inicial);
    } else if (idInicial) {
      mostrarResultado(`No existe un cliente con identificador ${idInicial}.`, "error");
    }
  } catch (error) {
    console.error("Error al cargar la lista de clientes:", error);
    buscador.placeholder = "Lista no disponible";
    mostrarResultado("No se pudo cargar la lista de clientes. Revisa la conexión y recarga la página.", "error");
  }
}

buscador.addEventListener("input", () => abrirLista());

// Al entrar al campo se muestran todos los clientes; escribir los filtra.
buscador.addEventListener("focus", () => {
  buscador.select?.();
  abrirLista(true);
});

// Al salir sin elegir, el campo vuelve a mostrar el cliente que se edita.
// Un clic con el campo ya enfocado (por ejemplo, después de elegir) reabre la
// lista y selecciona el texto. Se evita la acción del navegador, que movería el
// cursor y anularía la selección.
buscador.addEventListener("mousedown", (evento) => {
  if (!lista.hidden || document.activeElement !== buscador) return;
  evento.preventDefault();
  buscador.select();
  abrirLista(true);
});

buscador.addEventListener("blur", () => {
  cerrarLista();
  const cargado = clientes.find((cliente) => String(cliente.id) === idCargado);
  if (cargado) buscador.value = textoOpcion(cargado);
});

buscador.addEventListener("keydown", (evento) => {
  if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
    evento.preventDefault();
    if (lista.hidden) return abrirLista(true);
    if (visibles.length === 0) return;
    const paso = evento.key === "ArrowDown" ? 1 : -1;
    resaltar(Math.min(Math.max(activo + paso, 0), visibles.length - 1));
  } else if (evento.key === "Enter") {
    evento.preventDefault();
    if (!lista.hidden && activo >= 0) elegirCliente(visibles[activo]);
  } else if (evento.key === "Escape") {
    cerrarLista();
  }
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
  buscador.disabled = true;
  cerrarLista();
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
      quitarCliente(id);
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
    clientes = clientes.map((c) => (String(c.id) === id ? { ...c, ...cliente } : c));
    buscador.value = textoOpcion({ id, nombre: cliente.nombre });
    tituloDatos.textContent = `Datos de ${buscador.value}`;
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
    buscador.disabled = false;
    formulario.setAttribute("aria-busy", "false");
  }
});

// Permite enlazar directamente a la edición: /clientes/editar?cliente_id=ID
const idInicial = new URLSearchParams(window.location.search).get("cliente_id");
cargarListado(idInicial && idValido(idInicial) ? idInicial : null);
