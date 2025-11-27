// Manejo de persistencia en localStorage e IndexedDB para los audios.

const claveEstado = "soundboard-estado";
const nombreBaseDatos = "soundboard-audios";
const nombreStore = "audios";

const guardarEstadoLocal = (estado) => {
  const estadoSerializable = JSON.stringify(estado);
  localStorage.setItem(claveEstado, estadoSerializable);
};

const cargarEstadoLocal = () => {
  const datos = localStorage.getItem(claveEstado);
  if (!datos) return null;
  try {
    return JSON.parse(datos);
  } catch (error) {
    console.error("No se pudo leer el estado guardado", error);
    return null;
  }
};

const abrirBaseDatos = () =>
  new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(nombreBaseDatos, 1);
    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(nombreStore)) {
        bd.createObjectStore(nombreStore, { keyPath: "idPad" });
      }
    };
    solicitud.onerror = () => rechazar(solicitud.error);
    solicitud.onsuccess = () => resolver(solicitud.result);
  });

const leerArchivoComoBuffer = (archivo) =>
  new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result);
    lector.onerror = () => rechazar(lector.error);
    lector.readAsArrayBuffer(archivo);
  });

const guardarAudioEnIndexedDB = async (idPad, archivo) => {
  const baseDatos = await abrirBaseDatos();
  const buffer = await leerArchivoComoBuffer(archivo);
  await new Promise((resolver, rechazar) => {
    const transaccion = baseDatos.transaction(nombreStore, "readwrite");
    const store = transaccion.objectStore(nombreStore);
    store.put({
      idPad,
      buffer,
      tipo: archivo.type,
      nombre: archivo.name
    });
    transaccion.oncomplete = () => resolver();
    transaccion.onerror = () => rechazar(transaccion.error);
  });
};

const cargarAudioDeIndexedDB = async (idPad) => {
  const baseDatos = await abrirBaseDatos();
  return new Promise((resolver, rechazar) => {
    const transaccion = baseDatos.transaction(nombreStore, "readonly");
    const store = transaccion.objectStore(nombreStore);
    const solicitud = store.get(idPad);
    solicitud.onsuccess = () => {
      if (!solicitud.result) {
        resolver(null);
        return;
      }
      const { buffer, tipo, nombre } = solicitud.result;
      const blob = new Blob([buffer], { type: tipo });
      resolver({ blob, nombre });
    };
    solicitud.onerror = () => rechazar(solicitud.error);
  });
};

const eliminarAudioDeIndexedDB = async (idPad) => {
  const baseDatos = await abrirBaseDatos();
  return new Promise((resolver, rechazar) => {
    const transaccion = baseDatos.transaction(nombreStore, "readwrite");
    const store = transaccion.objectStore(nombreStore);
    store.delete(idPad);
    transaccion.oncomplete = () => resolver();
    transaccion.onerror = () => rechazar(transaccion.error);
  });
};

const limpiarAudios = async () => {
  const baseDatos = await abrirBaseDatos();
  return new Promise((resolver, rechazar) => {
    const transaccion = baseDatos.transaction(nombreStore, "readwrite");
    const store = transaccion.objectStore(nombreStore);
    store.clear();
    transaccion.oncomplete = () => resolver();
    transaccion.onerror = () => rechazar(transaccion.error);
  });
};

const descargarArchivoConfiguracion = (estado) => {
  const payload = {
    version: 1,
    creadoEn: new Date().toISOString(),
    estado
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "soundboard-configuracion.json";
  enlace.click();
  URL.revokeObjectURL(url);
};

const leerArchivoConfiguracion = async (archivo) => {
  const contenido = await archivo.text();
  const datos = JSON.parse(contenido);
  return datos.estado;
};

export {
  cargarAudioDeIndexedDB,
  cargarEstadoLocal,
  descargarArchivoConfiguracion,
  eliminarAudioDeIndexedDB,
  guardarAudioEnIndexedDB,
  guardarEstadoLocal,
  leerArchivoConfiguracion,
  limpiarAudios
};
