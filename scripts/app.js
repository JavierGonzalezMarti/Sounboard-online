// Punto de entrada de la aplicación. Todo el texto y variables están en español.

import {
  agregarPad,
  agregarPestana,
  actualizarColumnas,
  actualizarPad,
  actualizarReproduccionPad,
  calcularBorde,
  clonarEstado,
  crearEstadoInicial,
  eliminarPad,
  eliminarPestana,
  establecerPestanaActiva,
  formatearTiempo,
  normalizarEstado,
  paletaColores,
  renombrarPestana
} from "./estado.js";
import {
  cargarAudioDeIndexedDB,
  cargarEstadoLocal,
  descargarArchivoConfiguracion,
  eliminarAudioDeIndexedDB,
  guardarAudioEnIndexedDB,
  guardarAudiosImportados,
  guardarEstadoLocal,
  leerArchivoConfiguracion,
  limpiarAudios
} from "./almacenamiento.js";
import {
  ajustarVolumenPad,
  desmontarAudioPad,
  detenerAudio,
  obtenerAudioElemento,
  obtenerEstadoAudio,
  prepararAudioParaPad,
  reproducirAudio
} from "./audioControl.js";

const gridPads = document.getElementById("gridPads");
const selectorColumnas = document.getElementById("selectorColumnas");
const valorColumnas = document.getElementById("valorColumnas");
const contenedorPestanas = document.getElementById("contenedorPestanas");
const botonAgregarPestana = document.getElementById("botonAgregarPestana");
const botonGuardar = document.getElementById("botonGuardar");
const botonReiniciar = document.getElementById("botonReiniciar");
const cargadorArchivo = document.getElementById("cargadorArchivo");
const entradaArchivoOculta = document.getElementById("entradaArchivoOculta");
const flechaIzquierda = document.getElementById("flechaIzquierda");
const flechaDerecha = document.getElementById("flechaDerecha");

let estadoAplicacion = normalizarEstado(cargarEstadoLocal() || crearEstadoInicial());
let padEsperandoArchivo = null;
const temporizadores = new Map();
const intervaloTemporizadorMs = 250;
const volumenDucking = 0.35;
const saltoScrollPestanas = 150;
const umbralFinReproduccion = 0.12;
let padContextualActivo = null;

const limpiarExtensionNombre = (nombre) => {
  if (!nombre) return "";
  const ultimoPunto = nombre.lastIndexOf(".");
  if (ultimoPunto <= 0) return nombre;
  return nombre.slice(0, ultimoPunto);
};

const hexAComponentesRgb = (colorHex) => {
  if (!colorHex) return { r: 68, g: 82, b: 110 };
  const limpio = colorHex.replace("#", "");
  if (limpio.length < 6) return { r: 68, g: 82, b: 110 };
  const r = parseInt(limpio.substring(0, 2), 16);
  const g = parseInt(limpio.substring(2, 4), 16);
  const b = parseInt(limpio.substring(4, 6), 16);
  return { r, g, b };
};

const calcularAnguloRestante = (tiempoRestante, duracionTotal) => {
  if (!duracionTotal || !Number.isFinite(duracionTotal)) return "360deg";
  const restante = Math.max(0, Math.min(1, tiempoRestante / duracionTotal));
  return `${restante * 360}deg`;
};

const aplicarProgresoCircular = (elemento, tiempoRestante, duracionTotal) => {
  if (!elemento) return;
  elemento.style.setProperty("--angulo-restante", calcularAnguloRestante(tiempoRestante, duracionTotal));
};

const colorTextoContraste = (colorHex) => {
  const { r, g, b } = hexAComponentesRgb(colorHex);
  const brillo = 0.299 * r + 0.587 * g + 0.114 * b;
  const textoPrincipal = brillo > 160 ? "#0b0f19" : "#f7f7fb";
  const textoSuave =
    brillo > 160 ? "rgba(0, 0, 0, 0.7)" : "rgba(247, 247, 251, 0.78)";
  return { textoPrincipal, textoSuave };
};

const aplicarColoresPad = (elemento, pad) => {
  const { r, g, b } = hexAComponentesRgb(pad.colorBase);
  const { textoPrincipal, textoSuave } = colorTextoContraste(pad.colorBase);
  elemento.style.setProperty("--pad-color-rgb", `${r} ${g} ${b}`);
  elemento.style.setProperty("--pad-color-base", pad.colorBase);
  elemento.style.setProperty("--pad-color-borde", pad.colorBorde);
  elemento.style.setProperty("--pad-text-color-on", textoPrincipal);
  elemento.style.setProperty("--pad-text-muted-on", textoSuave);
  elemento.style.setProperty("--pad-text-color-off", "#f7f7fb");
  elemento.style.setProperty("--pad-text-muted-off", "rgba(247, 247, 251, 0.78)");
};

const ocultarContextoPad = () => {
  if (padContextualActivo) {
    padContextualActivo.classList.remove("contexto-pad-visible");
    padContextualActivo = null;
  }
};

const mostrarContextoPad = (contenedor) => {
  ocultarContextoPad();
  contenedor.classList.add("contexto-pad-visible");
  padContextualActivo = contenedor;
};

const limpiarExtensionesEstado = (estado) => ({
  ...estado,
  pestañas: estado.pestañas.map((pestana) => ({
    ...pestana,
    pads: pestana.pads.map((pad) => ({
      ...pad,
      nombreArchivo: limpiarExtensionNombre(pad.nombreArchivo)
    }))
  }))
});

estadoAplicacion = limpiarExtensionesEstado(estadoAplicacion);

const asegurarEstadoValido = () => {
  // Garantiza que exista al menos una pestaña activa visible.
  if (!estadoAplicacion.pestañas || estadoAplicacion.pestañas.length === 0) {
    estadoAplicacion = crearEstadoInicial();
    guardarEstadoLocal(estadoAplicacion);
    return;
  }
  const existeActiva = estadoAplicacion.pestañas.some(
    (p) => p.idPestana === estadoAplicacion.pestanaActivaId
  );
  if (!existeActiva) {
    estadoAplicacion = {
      ...estadoAplicacion,
      pestanaActivaId: estadoAplicacion.pestañas[0].idPestana
    };
    guardarEstadoLocal(estadoAplicacion);
  }
};

// -------------------------
// Utilidades de estado/DOM
// -------------------------

const obtenerPadPorId = (idPad) => {
  for (const pestana of estadoAplicacion.pestañas) {
    const pad = pestana.pads.find((p) => p.idPad === idPad);
    if (pad) return pad;
  }
  return null;
};

const obtenerPestanaActiva = () =>
  estadoAplicacion.pestañas.find(
    (pestana) => pestana.idPestana === estadoAplicacion.pestanaActivaId
  );

const obtenerPestanaActivaGarantizada = () => {
  let pestana = obtenerPestanaActiva();
  if (!pestana) {
    estadoAplicacion = normalizarEstado(crearEstadoInicial());
    pestana = obtenerPestanaActiva();
    guardarEstadoLocal(estadoAplicacion);
  }
  return pestana;
};

const obtenerIdPestanaDePad = (idPad) => {
  const pestana = estadoAplicacion.pestañas.find((p) =>
    p.pads.some((pad) => pad.idPad === idPad)
  );
  return pestana?.idPestana ?? estadoAplicacion.pestanaActivaId;
};

const eliminarPadDeEstado = async (idPad) => {
  const idPestana = obtenerIdPestanaDePad(idPad);
  const pad = obtenerPadPorId(idPad);
  if (!pad) return;
  detenerTemporizadorPad(idPad);
  await detenerAudio(idPad, { reinicioActivo: true, fadeOutActivo: false });
  desmontarAudioPad(idPad);
  await eliminarAudioDeIndexedDB(idPad);
  estadoAplicacion = eliminarPad(estadoAplicacion, idPestana, idPad);
  guardarYRenderizar();
};

const guardarYRenderizar = () => {
  guardarEstadoLocal(estadoAplicacion);
  renderizarPestanas();
  renderizarPads();
};

const actualizarColumnasUI = (columnas) => {
  const valor = columnas ?? estadoAplicacion.columnas ?? 5;
  document.documentElement.style.setProperty("--numero-columnas", valor);
  selectorColumnas.value = valor;
  valorColumnas.textContent = valor;
};

// -------------------------
// Render de pestañas
// -------------------------

const renderizarPestanas = () => {
  contenedorPestanas.innerHTML = "";
  estadoAplicacion.pestañas.forEach((pestana) => {
    const boton = document.createElement("button");
    boton.className = `pestana ${pestana.idPestana === estadoAplicacion.pestanaActivaId ? "activa" : ""}`;
    boton.textContent = pestana.nombre;
    const cerrar = document.createElement("button");
    cerrar.textContent = "✕";
    cerrar.className = "cerrar";
    cerrar.title = "Cerrar pestaña";
    cerrar.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const seguro = confirm(`¿Seguro que quieres cerrar "${pestana.nombre}"?`);
      if (!seguro) return;
      estadoAplicacion = eliminarPestana(estadoAplicacion, pestana.idPestana);
      guardarYRenderizar();
    });
    boton.appendChild(cerrar);
    boton.addEventListener("click", () => {
      if (pestana.idPestana === estadoAplicacion.pestanaActivaId) {
        const nuevoNombre = prompt("Renombra la pestaña", pestana.nombre);
        if (nuevoNombre && nuevoNombre.trim().length > 0) {
          estadoAplicacion = renombrarPestana(
            estadoAplicacion,
            pestana.idPestana,
            nuevoNombre.trim()
          );
          guardarYRenderizar();
        }
        return;
      }
      estadoAplicacion = establecerPestanaActiva(estadoAplicacion, pestana.idPestana);
      renderizarPestanas();
      renderizarPads();
      guardarEstadoLocal(estadoAplicacion);
    });
    contenedorPestanas.appendChild(boton);
  });
};

// -------------------------
// Render de pads
// -------------------------

const crearBotonIcono = (icono, activo, titulo) => {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = `pad-icono ${activo ? "activo" : ""}`;
  boton.textContent = icono;
  boton.title = titulo;
  return boton;
};

const mostrarSelectorColores = (contenedor, idPad) => {
  const selector = contenedor.querySelector(".selector-colores");
  selector.classList.add("visible");
  selector.innerHTML = "";
  paletaColores.forEach((color) => {
    const opcion = document.createElement("button");
    opcion.className = "color-opcion";
    opcion.style.background = color;
    opcion.addEventListener("click", (evento) => {
      evento.stopPropagation();
      const pad = obtenerPadPorId(idPad);
      if (!pad) return;
      estadoAplicacion = actualizarPad(estadoAplicacion, obtenerIdPestanaDePad(idPad), idPad, {
        colorBase: color,
        colorBorde: calcularBorde(color)
      });
      guardarYRenderizar();
    });
    selector.appendChild(opcion);
  });
  document.addEventListener(
    "click",
    () => selector.classList.remove("visible"),
    { once: true }
  );
};

const crearPadElemento = (pad) => {
  const contenedor = document.createElement("div");
  contenedor.className = "pad";
  contenedor.dataset.padId = pad.idPad;
  aplicarColoresPad(contenedor, pad);
  contenedor.classList.toggle("reproduciendo", pad.reproduccion.reproduciendo);

  const ondaFondo = document.createElement("div");
  ondaFondo.className = "onda-fondo";
  ondaFondo.innerHTML = "<span></span><span></span><span></span>";
  contenedor.appendChild(ondaFondo);

  const botonEliminarPad = document.createElement("button");
  botonEliminarPad.type = "button";
  botonEliminarPad.className = "boton-eliminar-pad";
  botonEliminarPad.textContent = "Eliminar pad";
  botonEliminarPad.addEventListener("click", (evento) => {
    evento.stopPropagation();
    ocultarContextoPad();
    eliminarPadDeEstado(pad.idPad);
  });
  contenedor.appendChild(botonEliminarPad);

  const selectorColores = document.createElement("div");
  selectorColores.className = "selector-colores";
  contenedor.appendChild(selectorColores);

  const controles = document.createElement("div");
  controles.className = "pad-controles";
  const botonDucking = crearBotonIcono("🦆", pad.opciones.duckingActivo, "Ducking activo");
  const botonBucle = crearBotonIcono("↻", pad.opciones.bucleActivo, "Bucle infinito");
  const botonReinicio = crearBotonIcono("↩︎", pad.opciones.reinicioActivo, "Reproducir desde inicio");
  const botonColor = crearBotonIcono("🎨", false, "Cambiar color");
  const botonFadeIn = crearBotonIcono("⤴︎", pad.opciones.fadeInActivo, "Fade in al iniciar");
  const botonFadeOut = crearBotonIcono("⤵︎", pad.opciones.fadeOutActivo, "Fade out al detener");

  const botones = [
    { boton: botonDucking, clave: "duckingActivo" },
    { boton: botonBucle, clave: "bucleActivo" },
    { boton: botonReinicio, clave: "reinicioActivo" },
    { boton: botonColor, clave: "color" },
    { boton: botonFadeIn, clave: "fadeInActivo" },
    { boton: botonFadeOut, clave: "fadeOutActivo" }
  ];

  botones.forEach(({ boton, clave }) => {
    boton.addEventListener("click", (evento) => {
      evento.stopPropagation();
      if (clave === "color") {
        mostrarSelectorColores(contenedor, pad.idPad);
        return;
      }
      const cambios = {
        opciones: {
          ...pad.opciones,
          [clave]: !pad.opciones[clave]
        }
      };
      estadoAplicacion = actualizarPad(
        estadoAplicacion,
        obtenerIdPestanaDePad(pad.idPad),
        pad.idPad,
        cambios
      );
      if (clave === "duckingActivo") {
        recalcularDucking();
      }
      guardarYRenderizar();
    });
    controles.appendChild(boton);
  });

  contenedor.appendChild(controles);

  if (pad.necesitaRecarga) {
    const aviso = document.createElement("div");
    aviso.className = "estado-advertencia";
    aviso.textContent = "Recarga el audio";
    contenedor.appendChild(aviso);
  }

  const nombre = document.createElement("div");
  nombre.className = `pad-nombre ${pad.archivo ? "" : "vacio"}`;
  const nombreVisible = limpiarExtensionNombre(pad.nombreArchivo) || "Vacío";
  nombre.textContent = nombreVisible;
  contenedor.appendChild(nombre);

  const tiempos = document.createElement("div");
  tiempos.className = "pad-tiempos";
  const tiempoTotal = document.createElement("span");
  tiempoTotal.className = "tiempo-total";
  tiempoTotal.textContent = formatearTiempo(pad.reproduccion.duracionTotal || 0);
  const tiempoRestante = document.createElement("span");
  tiempoRestante.className = "tiempo-restante";
  const textoRestante = pad.reproduccion.reproduciendo
    ? `-${formatearTiempo(pad.reproduccion.tiempoRestante)}`
    : "-00:00";
  tiempoRestante.textContent = textoRestante;
  const indicadorCircular = document.createElement("span");
  indicadorCircular.className = "reloj-circular";
  aplicarProgresoCircular(
    indicadorCircular,
    pad.reproduccion.tiempoRestante || 0,
    pad.reproduccion.duracionTotal || 0
  );

  tiempos.append(tiempoTotal, indicadorCircular, tiempoRestante);
  contenedor.appendChild(tiempos);

  contenedor.addEventListener("click", () => manejarClickPad(pad.idPad));
  contenedor.addEventListener("contextmenu", (evento) => {
    evento.preventDefault();
    mostrarContextoPad(contenedor);
  });
  contenedor.addEventListener("dragover", (evento) => {
    evento.preventDefault();
    contenedor.classList.add("dropzone-activa");
  });
  contenedor.addEventListener("dragleave", () =>
    contenedor.classList.remove("dropzone-activa")
  );
  contenedor.addEventListener("drop", (evento) => {
    evento.preventDefault();
    contenedor.classList.remove("dropzone-activa");
    const archivo = evento.dataTransfer.files?.[0];
    if (archivo) {
      asignarArchivoAPad(pad.idPad, archivo);
    }
  });

  return contenedor;
};

const crearPadVacio = () => {
  const contenedor = document.createElement("div");
  contenedor.className = "pad placeholder-vacio";
  contenedor.innerHTML =
    "<div class='pad-nombre'><span aria-hidden='true'>＋</span> Añadir pad</div>";
  contenedor.addEventListener("click", () => {
    const pestana = obtenerPestanaActivaGarantizada();
    estadoAplicacion = agregarPad(estadoAplicacion, pestana.idPestana);
    guardarYRenderizar();
  });
  contenedor.addEventListener("dragover", (evento) => {
    evento.preventDefault();
    contenedor.classList.add("dropzone-activa");
  });
  contenedor.addEventListener("dragleave", () =>
    contenedor.classList.remove("dropzone-activa")
  );
  contenedor.addEventListener("drop", (evento) => {
    evento.preventDefault();
    contenedor.classList.remove("dropzone-activa");
    const archivo = evento.dataTransfer.files?.[0];
    if (!archivo) return;
    const pestana = obtenerPestanaActivaGarantizada();
    estadoAplicacion = agregarPad(estadoAplicacion, pestana.idPestana);
    const pestanaActualizada = obtenerPestanaActivaGarantizada();
    const nuevoPad = pestanaActualizada.pads[pestanaActualizada.pads.length - 1];
    if (nuevoPad) {
      asignarArchivoAPad(nuevoPad.idPad, archivo);
    }
    guardarYRenderizar();
  });
  return contenedor;
};

const renderizarPads = () => {
  gridPads.innerHTML = "";
  const pestana = obtenerPestanaActiva();
  if (!pestana) {
    estadoAplicacion = crearEstadoInicial();
    guardarEstadoLocal(estadoAplicacion);
    return renderizarPads();
  }
  const listaPads = Array.isArray(pestana.pads) ? pestana.pads : [];
  gridPads.classList.toggle("grid-sin-pads", listaPads.length === 0);
  listaPads.forEach((pad) => {
    const elemento = crearPadElemento(pad);
    gridPads.appendChild(elemento);
  });
  gridPads.appendChild(crearPadVacio());
  if (gridPads.childElementCount === 0) {
    gridPads.classList.add("grid-sin-pads");
    gridPads.appendChild(crearPadVacio());
  }
};

// -------------------------
// Reproducción y timers
// -------------------------

const detenerTemporizadorPad = (idPad) => {
  const intervalo = temporizadores.get(idPad);
  if (intervalo) {
    clearInterval(intervalo);
    temporizadores.delete(idPad);
  }
};

const iniciarTemporizadorPad = (idPad) => {
  // Refresca la cuenta atrás del pad mientras suena.
  detenerTemporizadorPad(idPad);
  const intervalo = setInterval(() => {
    const estadoAudio = obtenerEstadoAudio(idPad);
    const pad = obtenerPadPorId(idPad);
    if (!estadoAudio || !pad) {
      detenerTemporizadorPad(idPad);
      return;
    }
    const tiempoRestante = Math.max(
      0,
      (estadoAudio.duracion || pad.reproduccion.duracionTotal) - estadoAudio.tiempoTranscurrido
    );
    estadoAplicacion = actualizarReproduccionPad(
      estadoAplicacion,
      obtenerIdPestanaDePad(idPad),
      idPad,
      { tiempoRestante }
    );
    actualizarTiempoEnUI(idPad, tiempoRestante, estadoAudio.duracion);
    if (tiempoRestante <= umbralFinReproduccion) {
      detenerTemporizadorPad(idPad);
    }
  }, intervaloTemporizadorMs);
  temporizadores.set(idPad, intervalo);
};

const actualizarTiempoEnUI = (idPad, tiempoRestante, duracionTotal) => {
  const contenedor = document.querySelector(`[data-pad-id="${idPad}"]`);
  if (!contenedor) return;
  const etiquetaRestante = contenedor.querySelector(".tiempo-restante");
  const etiquetaTotal = contenedor.querySelector(".tiempo-total");
  const indicadorCircular = contenedor.querySelector(".reloj-circular");
  if (etiquetaRestante) {
    etiquetaRestante.textContent = `-${formatearTiempo(tiempoRestante)}`;
  }
  if (indicadorCircular) {
    aplicarProgresoCircular(indicadorCircular, tiempoRestante, duracionTotal);
  }
  if (etiquetaTotal && Number.isFinite(duracionTotal)) {
    etiquetaTotal.textContent = formatearTiempo(duracionTotal);
  }
};

const detenerTodosLosPads = async () => {
  temporizadores.forEach((intervalo) => clearInterval(intervalo));
  temporizadores.clear();
  const pads = estadoAplicacion.pestañas.flatMap((p) => p.pads);
  await Promise.all(
    pads.map((pad) =>
      detenerAudio(pad.idPad, {
        reinicioActivo: true,
        fadeOutActivo: pad.opciones.fadeOutActivo
      })
    )
  );
};

const recalcularDucking = () => {
  // Reduce el volumen de los pads con ducking cuando otro pad está sonando.
  const padsReproduciendo = estadoAplicacion.pestañas
    .flatMap((p) => p.pads)
    .filter((p) => p.reproduccion.reproduciendo);
  estadoAplicacion.pestañas.forEach((pestana) => {
    pestana.pads.forEach((pad) => {
      if (pad.opciones.duckingActivo && padsReproduciendo.some((otro) => otro.idPad !== pad.idPad)) {
        ajustarVolumenPad(pad.idPad, volumenDucking);
      } else {
        ajustarVolumenPad(pad.idPad, 1);
      }
    });
  });
};

const manejarFinalizacionPad = async (idPad) => {
  // Decide si se reinicia (bucle) o se detiene al terminar el audio.
  const pad = obtenerPadPorId(idPad);
  if (!pad) return;
  if (pad.opciones.bucleActivo) {
    await reproducirAudio(idPad, {
      reinicioActivo: true,
      bucleActivo: true,
      fadeInActivo: pad.opciones.fadeInActivo
    });
    iniciarTemporizadorPad(idPad);
    return;
  }
  estadoAplicacion = actualizarReproduccionPad(
    estadoAplicacion,
    obtenerIdPestanaDePad(idPad),
    idPad,
    { reproduciendo: false, tiempoRestante: 0 }
  );
  detenerTemporizadorPad(idPad);
  recalcularDucking();
  renderizarPads();
  guardarEstadoLocal(estadoAplicacion);
};

const iniciarReproduccionPad = async (pad) => {
  // Arranca la reproducción respetando reinicio, bucle y efecto fade.
  const idPestana = obtenerIdPestanaDePad(pad.idPad);
  const pestana = estadoAplicacion.pestañas.find((p) => p.idPestana === idPestana);
  try {
    const tiempo = await reproducirAudio(pad.idPad, {
      reinicioActivo: pad.opciones.reinicioActivo,
      bucleActivo: pad.opciones.bucleActivo,
      fadeInActivo: pad.opciones.fadeInActivo
    });
    const audio = obtenerAudioElemento(pad.idPad);
    if (audio) {
      audio.onended = () => manejarFinalizacionPad(pad.idPad);
    }
    estadoAplicacion = actualizarReproduccionPad(
      estadoAplicacion,
      idPestana,
      pad.idPad,
      {
        reproduciendo: true,
        duracionTotal: audio?.duration || pad.reproduccion.duracionTotal,
        tiempoRestante:
          tiempo ?? audio?.duration ?? pad.reproduccion.tiempoRestante ?? pad.reproduccion.duracionTotal
      }
    );
    iniciarTemporizadorPad(pad.idPad);
    recalcularDucking();
    renderizarPads();
    guardarEstadoLocal(estadoAplicacion);
  } catch (error) {
    console.error("No se pudo reproducir el pad", error);
  }
};

const detenerReproduccionPad = async (pad) => {
  // Pausa el audio aplicando fade si procede y conserva la posición si se pidió.
  const idPestana = obtenerIdPestanaDePad(pad.idPad);
  const estadoAudio = obtenerEstadoAudio(pad.idPad);
  const tiempoRestante = estadoAudio
    ? Math.max(
        0,
        (estadoAudio.duracion || pad.reproduccion.duracionTotal) - estadoAudio.tiempoTranscurrido
      )
    : pad.reproduccion.duracionTotal;
  await detenerAudio(pad.idPad, {
    reinicioActivo: pad.opciones.reinicioActivo,
    fadeOutActivo: pad.opciones.fadeOutActivo
  });
  detenerTemporizadorPad(pad.idPad);
  estadoAplicacion = actualizarReproduccionPad(
    estadoAplicacion,
    idPestana,
    pad.idPad,
    { reproduciendo: false, tiempoRestante }
  );
  recalcularDucking();
  renderizarPads();
  guardarEstadoLocal(estadoAplicacion);
};

const manejarClickPad = async (idPad) => {
  const pad = obtenerPadPorId(idPad);
  if (!pad) return;
  if (!pad.archivo || pad.necesitaRecarga) {
    padEsperandoArchivo = idPad;
    entradaArchivoOculta.value = "";
    entradaArchivoOculta.click();
    return;
  }
  const estadoAudio = obtenerEstadoAudio(idPad);
  if (estadoAudio?.enCurso) {
    await detenerReproduccionPad(pad);
  } else {
    await iniciarReproduccionPad(pad);
  }
};

// -------------------------
// Asignación de archivos
// -------------------------

const asignarArchivoAPad = async (idPad, archivo) => {
  // Vincula un archivo de audio a un pad y persiste sus metadatos.
  if (!archivo || !archivo.type.startsWith("audio/")) {
    alert("Selecciona un archivo de audio válido.");
    return;
  }
  try {
    const duracion = await prepararAudioParaPad(idPad, archivo);
    const audio = obtenerAudioElemento(idPad);
    if (audio) {
      audio.onended = () => manejarFinalizacionPad(idPad);
    }
    await guardarAudioEnIndexedDB(idPad, archivo);
    const cambios = {
      archivo: { nombre: archivo.name, tipo: archivo.type },
      nombreArchivo: limpiarExtensionNombre(archivo.name),
      reproduccion: { duracionTotal: duracion, tiempoRestante: duracion, reproduciendo: false },
      necesitaRecarga: false
    };
    estadoAplicacion = actualizarPad(
      estadoAplicacion,
      obtenerIdPestanaDePad(idPad),
      idPad,
      cambios
    );
    guardarYRenderizar();
  } catch (error) {
    console.error("No se pudo preparar el audio", error);
  }
};

const restaurarAudios = async () => {
  // Reconstruye los audios guardados tras recargar la página o importar un proyecto.
  const estados = clonarEstado(estadoAplicacion);
  for (const pestana of estados.pestañas) {
    for (const pad of pestana.pads) {
      if (!pad.archivo) continue;
      try {
        const resultado = await cargarAudioDeIndexedDB(pad.idPad);
        if (!resultado) {
          pad.necesitaRecarga = true;
          continue;
        }
        const duracion = await prepararAudioParaPad(pad.idPad, resultado.blob);
        const audio = obtenerAudioElemento(pad.idPad);
        if (audio) {
          audio.onended = () => manejarFinalizacionPad(pad.idPad);
        }
        pad.reproduccion.duracionTotal = duracion;
        pad.reproduccion.tiempoRestante = duracion;
        pad.necesitaRecarga = false;
      } catch (error) {
        pad.necesitaRecarga = true;
      }
    }
  }
  estadoAplicacion = estados;
  guardarYRenderizar();
};

// -------------------------
// Gestión de botones de proyecto
// -------------------------

const configurarEventos = () => {
  selectorColumnas.addEventListener("input", () => {
    const columnas = Number(selectorColumnas.value);
    estadoAplicacion = actualizarColumnas(estadoAplicacion, columnas);
    actualizarColumnasUI(columnas);
    guardarEstadoLocal(estadoAplicacion);
    renderizarPads();
  });

  botonAgregarPestana.addEventListener("click", () => {
    const nombre = prompt("Nombre de la nueva pestaña", `Pestaña ${estadoAplicacion.pestañas.length + 1}`);
    estadoAplicacion = agregarPestana(estadoAplicacion, nombre || "Pestaña nueva");
    guardarYRenderizar();
  });

  botonGuardar.addEventListener("click", async () => {
    await descargarArchivoConfiguracion(estadoAplicacion);
  });

  cargadorArchivo.addEventListener("change", async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    try {
      const { estado, audios } = await leerArchivoConfiguracion(archivo);
      await detenerTodosLosPads();
      await limpiarAudios();
      await guardarAudiosImportados(audios);
      estadoAplicacion = limpiarExtensionesEstado(estado);
      asegurarEstadoValido();
      await restaurarAudios();
      actualizarColumnasUI(estadoAplicacion.columnas);
    } catch (error) {
      alert("No se pudo cargar la configuración.");
      console.error(error);
    }
  });

  botonReiniciar.addEventListener("click", async () => {
    const confirmar = confirm("Esto limpiará todas las pestañas y audios. ¿Continuar?");
    if (!confirmar) return;
    await detenerTodosLosPads();
    await limpiarAudios();
    estadoAplicacion = crearEstadoInicial();
    asegurarEstadoValido();
    guardarYRenderizar();
    actualizarColumnasUI(estadoAplicacion.columnas);
  });

  entradaArchivoOculta.addEventListener("change", (evento) => {
    const archivo = evento.target.files?.[0];
    if (archivo && padEsperandoArchivo) {
      asignarArchivoAPad(padEsperandoArchivo, archivo);
    }
    padEsperandoArchivo = null;
  });

  flechaIzquierda.addEventListener("click", () => {
    contenedorPestanas.scrollBy({ left: -saltoScrollPestanas, behavior: "smooth" });
  });
  flechaDerecha.addEventListener("click", () => {
    contenedorPestanas.scrollBy({ left: saltoScrollPestanas, behavior: "smooth" });
  });

  document.addEventListener("click", ocultarContextoPad);
  document.addEventListener("contextmenu", (evento) => {
    const pad = evento.target.closest(".pad[data-pad-id]");
    if (!pad) {
      evento.preventDefault();
      ocultarContextoPad();
    }
  });
};

// -------------------------
// Inicio
// -------------------------

const iniciar = async () => {
  asegurarEstadoValido();
  const pestana = obtenerPestanaActivaGarantizada();
  if (pestana.pads.length === 0) {
    // Creamos un primer pad vacío automático para que siempre haya uno visible.
    estadoAplicacion = agregarPad(estadoAplicacion, pestana.idPestana);
  }
  actualizarColumnasUI(estadoAplicacion.columnas);
  renderizarPestanas();
  renderizarPads();
  configurarEventos();
  await restaurarAudios();
};

document.addEventListener("DOMContentLoaded", iniciar);
