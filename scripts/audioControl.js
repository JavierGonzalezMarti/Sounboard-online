// Control específico de Audio para los pads.
// Se mantiene separado para que la lógica de UI sea más clara.

import { duracionFadePorDefecto } from "./estado.js";

const audiosPorPad = new Map();

const prepararAudioParaPad = (idPad, blob) =>
  new Promise((resolver, rechazar) => {
    const urlObjeto = URL.createObjectURL(blob);
    const audio = new Audio(urlObjeto);
    audio.preload = "auto";
    audio.onloadedmetadata = () => {
      audiosPorPad.set(idPad, { audio, urlObjeto });
      resolver(audio.duration || 0);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(urlObjeto);
      rechazar(new Error("No se pudo cargar el audio."));
    };
  });

const desmontarAudioPad = (idPad) => {
  const registro = audiosPorPad.get(idPad);
  if (!registro) return;
  registro.audio.pause();
  URL.revokeObjectURL(registro.urlObjeto);
  audiosPorPad.delete(idPad);
};

const aplicarFade = (audio, volumenObjetivo, duracion = duracionFadePorDefecto) =>
  new Promise((resolver) => {
    const volumenInicial = audio.volume;
    const diferencia = volumenObjetivo - volumenInicial;
    if (diferencia === 0) {
      resolver();
      return;
    }
    const momentoInicio = performance.now();
    const animar = (momentoActual) => {
      const progreso = Math.min((momentoActual - momentoInicio) / duracion, 1);
      audio.volume = Math.min(1, Math.max(0, volumenInicial + diferencia * progreso));
      if (progreso < 1) {
        requestAnimationFrame(animar);
      } else {
        resolver();
      }
    };
    requestAnimationFrame(animar);
  });

const reproducirAudio = async (
  idPad,
  { reinicioActivo, bucleActivo, fadeInActivo, duracionFade } = {}
) => {
  const registro = audiosPorPad.get(idPad);
  if (!registro) return null;
  const audio = registro.audio;
  audio.loop = Boolean(bucleActivo);
  if (reinicioActivo) {
    audio.currentTime = 0;
  }
  if (fadeInActivo) {
    audio.volume = 0;
    await audio.play();
    await aplicarFade(audio, 1, duracionFade ?? duracionFadePorDefecto);
  } else {
    audio.volume = 1;
    await audio.play();
  }
  const tiempoRestante = Math.max(0, (audio.duration || 0) - audio.currentTime);
  return tiempoRestante;
};

const detenerAudio = async (
  idPad,
  { reinicioActivo, fadeOutActivo, duracionFade } = {}
) => {
  const registro = audiosPorPad.get(idPad);
  if (!registro) return;
  const audio = registro.audio;
  if (fadeOutActivo) {
    await aplicarFade(audio, 0, duracionFade ?? duracionFadePorDefecto);
  }
  audio.pause();
  if (reinicioActivo) {
    audio.currentTime = 0;
  }
};

const obtenerEstadoAudio = (idPad) => {
  const registro = audiosPorPad.get(idPad);
  if (!registro) return null;
  const audio = registro.audio;
  return {
    duracion: audio.duration || 0,
    tiempoTranscurrido: audio.currentTime || 0,
    enCurso: !audio.paused
  };
};

const ajustarVolumenPad = (idPad, volumen) => {
  const registro = audiosPorPad.get(idPad);
  if (!registro) return;
  registro.audio.volume = Math.max(0, Math.min(1, volumen));
};

const obtenerAudioElemento = (idPad) => audiosPorPad.get(idPad)?.audio ?? null;

export {
  ajustarVolumenPad,
  aplicarFade,
  detenerAudio,
  obtenerEstadoAudio,
  prepararAudioParaPad,
  reproducirAudio,
  desmontarAudioPad,
  obtenerAudioElemento
};
