// Manejo de persistencia en localStorage e IndexedDB para los audios.

const claveEstado = "soundboard-estado";
const nombreBaseDatos = "soundboard-audios";
const nombreStore = "audios";

const bufferABase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  bytes.forEach((b) => {
    binario += String.fromCharCode(b);
  });
  return btoa(binario);
};

const base64ABuffer = (cadena) => {
  const binario = atob(cadena);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes.buffer;
};

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
  const buffer = await leerArchivoComoBuffer(archivo);
  await guardarAudioBufferEnIndexedDB(idPad, buffer, archivo.type, archivo.name);
};

const guardarAudioBufferEnIndexedDB = async (idPad, buffer, tipo, nombre) => {
  const baseDatos = await abrirBaseDatos();
  await new Promise((resolver, rechazar) => {
    const transaccion = baseDatos.transaction(nombreStore, "readwrite");
    const store = transaccion.objectStore(nombreStore);
    store.put({
      idPad,
      buffer,
      tipo,
      nombre
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

const descargarArchivoConfiguracion = async (estado) => {
  const ids = Array.from(
    new Set(estado.pestañas.flatMap((pestana) => pestana.pads.map((pad) => pad.idPad)))
  );

  const audios = await Promise.all(ids.map((idPad) => cargarAudioDeIndexedDB(idPad)));
  const audiosExportables = await Promise.all(
    audios.map(async (audio, indice) => {
      if (!audio?.blob) return null;
      const buffer = await audio.blob.arrayBuffer();
      return {
        idPad: ids[indice],
        tipo: audio.blob.type,
        nombre: audio.nombre || audio.blob.name,
        base64: bufferABase64(buffer)
      };
    })
  );

  const payload = {
    version: 2,
    creadoEn: new Date().toISOString(),
    estado,
    audios: audiosExportables.filter(Boolean)
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

const guardarAudiosImportados = async (audios = []) => {
  if (!Array.isArray(audios)) return;
  for (const audio of audios) {
    if (!audio?.base64 || !audio?.idPad) continue;
    const buffer = base64ABuffer(audio.base64);
    const tipo = audio.tipo || "audio/wav";
    const nombre = audio.nombre || "audio";
    await guardarAudioBufferEnIndexedDB(audio.idPad, buffer, tipo, nombre);
  }
};

const leerArchivoConfiguracion = async (archivo) => {
  const contenido = await archivo.text();
  const datos = JSON.parse(contenido);
  return { estado: datos.estado, audios: datos.audios || [] };
};

export {
  cargarAudioDeIndexedDB,
  cargarEstadoLocal,
  descargarArchivoConfiguracion,
  eliminarAudioDeIndexedDB,
  guardarAudioEnIndexedDB,
  guardarAudioBufferEnIndexedDB,
  guardarAudiosImportados,
  guardarEstadoLocal,
  leerArchivoConfiguracion,
  limpiarAudios
};
