// Estado y utilidades puras para la soundboard.
// Todo el código mantiene nombres en español y evita efectos secundarios para poder probar con facilidad.

const paletaColores = [
  "#fef3c7",
  "#fde047",
  "#facc15",
  "#fcd34d",
  "#fb923c",
  "#f97316",
  "#ea580c",
  "#d97706",
  "#f59e0b",
  "#a3e635",
  "#84cc16",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#34d399",
  "#10b981",
  "#bbf7d0",
  "#2dd4bf",
  "#14b8a6",
  "#22d3ee",
  "#67e8f9",
  "#e0f2fe",
  "#0ea5e9",
  "#38bdf8",
  "#3b82f6",
  "#2563eb",
  "#1d4ed8",
  "#5b21b6",
  "#4c1d95",
  "#4338ca",
  "#8b5cf6",
  "#a855f7",
  "#c084fc",
  "#f5d0fe",
  "#7c3aed",
  "#d946ef",
  "#ec4899",
  "#f472b6",
  "#fb7185",
  "#f87171",
  "#ef4444",
  "#dc2626",
  "#9ca3af",
  "#94a3b8",
  "#cbd5e1",
  "#4b5563",
  "#475569",
  "#334155",
  "#1f2937",
  "#0f172a",
  "#18181b"
];

const duracionFadePorDefecto = 2000;

const crearIdUnico = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `pad-${Date.now()}-${Math.floor(Math.random() * 10000)}`);

const calcularBorde = (colorHex) => {
  const canal = (hex) => parseInt(hex, 16);
  const limpiar = colorHex.replace("#", "");
  const r = canal(limpiar.substring(0, 2));
  const g = canal(limpiar.substring(2, 4));
  const b = canal(limpiar.substring(4, 6));
  const factorBrillo = 1.18;
  const nuevo = (valor) => Math.min(255, Math.round(valor * factorBrillo));
  return `rgb(${nuevo(r)}, ${nuevo(g)}, ${nuevo(b)})`;
};

const crearPadBase = (indiceColor = 0) => {
  const colorBase = paletaColores[indiceColor % paletaColores.length];
  return {
    idPad: crearIdUnico(),
    nombreArchivo: "Vacío",
    colorBase,
    colorBorde: calcularBorde(colorBase),
    opciones: {
      duckingActivo: false,
      bucleActivo: false,
      reinicioActivo: true,
      fadeInActivo: false,
      fadeOutActivo: false
    },
    reproduccion: {
      reproduciendo: false,
      duracionTotal: 0,
      tiempoRestante: 0
    },
    archivo: null,
    necesitaRecarga: false
  };
};

const crearEstadoInicial = (numeroPestanas = 3, columnas = 5) => {
  let indiceColor = 0;
  const pestañas = Array.from({ length: numeroPestanas }).map((_, indice) => {
    const padInicial = crearPadBase(indiceColor);
    indiceColor += 1;
    return {
      idPestana: crearIdUnico(),
      nombre: `Pestaña ${indice + 1}`,
      pads: [padInicial]
    };
  });
  return {
    pestañas,
    pestanaActivaId: pestañas[0].idPestana,
    columnas,
    indiceColor
  };
};

const buscarPestana = (estado, idPestana) =>
  estado.pestañas.find((p) => p.idPestana === idPestana);

const formatearTiempo = (segundos) => {
  if (!Number.isFinite(segundos) || segundos < 0) return "00:00";
  const minutos = Math.floor(segundos / 60)
    .toString()
    .padStart(2, "0");
  const resto = Math.floor(segundos % 60)
    .toString()
    .padStart(2, "0");
  return `${minutos}:${resto}`;
};

const agregarPad = (estado, idPestana) => {
  const nuevaPestana = buscarPestana(estado, idPestana);
  if (!nuevaPestana) return estado;
  const padsExistentes = Array.isArray(nuevaPestana.pads) ? nuevaPestana.pads : [];
  const nuevoIndiceColor = estado.indiceColor + 1;
  const pad = crearPadBase(estado.indiceColor);
  const pestanasActualizadas = estado.pestañas.map((p) =>
    p.idPestana === idPestana ? { ...p, pads: [...padsExistentes, pad] } : p
  );
  return {
    ...estado,
    pestañas: pestanasActualizadas,
    indiceColor: nuevoIndiceColor
  };
};

const normalizarEstado = (estado) => {
  if (!estado || !Array.isArray(estado.pestañas) || estado.pestañas.length === 0) {
    return crearEstadoInicial();
  }
  const pestañas = estado.pestañas.map((p) => ({
    ...p,
    pads: Array.isArray(p.pads) ? p.pads : []
  }));
  const pestanaActivaValida = pestañas.find((p) => p.idPestana === estado.pestanaActivaId);
  return {
    ...estado,
    pestañas,
    pestanaActivaId: pestanaActivaValida ? estado.pestanaActivaId : pestañas[0].idPestana,
    columnas: Number.isFinite(estado.columnas) ? estado.columnas : 5,
    indiceColor: Number.isFinite(estado.indiceColor) ? estado.indiceColor : 0
  };
};

const actualizarPad = (estado, idPestana, idPad, cambios) => {
  const pestanasActualizadas = estado.pestañas.map((p) => {
    if (p.idPestana !== idPestana) return p;
    const padsActualizados = p.pads.map((pad) =>
      pad.idPad === idPad ? { ...pad, ...cambios } : pad
    );
    return { ...p, pads: padsActualizados };
  });
  return { ...estado, pestañas: pestanasActualizadas };
};

const actualizarReproduccionPad = (
  estado,
  idPestana,
  idPad,
  cambiosReproduccion
) => {
  const pestanasActualizadas = estado.pestañas.map((p) => {
    if (p.idPestana !== idPestana) return p;
    const padsActualizados = p.pads.map((pad) =>
      pad.idPad === idPad
        ? { ...pad, reproduccion: { ...pad.reproduccion, ...cambiosReproduccion } }
        : pad
    );
    return { ...p, pads: padsActualizados };
  });
  return { ...estado, pestañas: pestanasActualizadas };
};

const establecerPestanaActiva = (estado, idPestana) => {
  if (!buscarPestana(estado, idPestana)) return estado;
  return { ...estado, pestanaActivaId: idPestana };
};

const eliminarPad = (estado, idPestana, idPad) => {
  const pestanasActualizadas = estado.pestañas.map((p) => {
    if (p.idPestana !== idPestana) return p;
    return { ...p, pads: p.pads.filter((pad) => pad.idPad !== idPad) };
  });
  return { ...estado, pestañas: pestanasActualizadas };
};

const agregarPestana = (estado, nombre = "Nueva pestaña") => {
  const padInicial = crearPadBase(estado.indiceColor);
  const nuevaPestana = {
    idPestana: crearIdUnico(),
    nombre,
    pads: [padInicial]
  };
  return {
    ...estado,
    pestañas: [...estado.pestañas, nuevaPestana],
    pestanaActivaId: nuevaPestana.idPestana,
    indiceColor: estado.indiceColor + 1
  };
};

const renombrarPestana = (estado, idPestana, nombre) => {
  const pestanasActualizadas = estado.pestañas.map((p) =>
    p.idPestana === idPestana ? { ...p, nombre } : p
  );
  return { ...estado, pestañas: pestanasActualizadas };
};

const eliminarPestana = (estado, idPestana) => {
  if (estado.pestañas.length === 1) return estado;
  const restantes = estado.pestañas.filter((p) => p.idPestana !== idPestana);
  const nuevaActiva =
    estado.pestanaActivaId === idPestana ? restantes[0].idPestana : estado.pestanaActivaId;
  return { ...estado, pestañas: restantes, pestanaActivaId: nuevaActiva };
};

const actualizarColumnas = (estado, columnas) => ({
  ...estado,
  columnas
});

const clonarEstado = (estado) => JSON.parse(JSON.stringify(estado));

export {
  agregarPad,
  agregarPestana,
  actualizarColumnas,
  actualizarPad,
  actualizarReproduccionPad,
  calcularBorde,
  clonarEstado,
  crearEstadoInicial,
  crearPadBase,
  duracionFadePorDefecto,
  eliminarPestana,
  eliminarPad,
  establecerPestanaActiva,
  formatearTiempo,
  paletaColores,
  normalizarEstado,
  renombrarPestana
};
