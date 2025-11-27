import test from "node:test";
import assert from "node:assert/strict";
import {
  agregarPad,
  actualizarPad,
  calcularBorde,
  crearEstadoInicial,
  formatearTiempo,
  paletaColores
} from "../scripts/estado.js";

test("crearEstadoInicial genera tres pestañas y columnas por defecto", () => {
  const estado = crearEstadoInicial();
  assert.equal(estado.pestañas.length, 3);
  assert.equal(estado.columnas, 5);
  assert.ok(estado.pestanaActivaId);
  estado.pestañas.forEach((p) => {
    assert.ok(p.pads.length >= 1, "Cada pestaña debe iniciar con al menos un pad");
  });
});

test("agregarPad suma un pad en la pestaña activa", () => {
  let estado = crearEstadoInicial(1);
  const idPestana = estado.pestanaActivaId;
  const cantidadAntes = estado.pestañas[0].pads.length;
  estado = agregarPad(estado, idPestana);
  assert.equal(estado.pestañas[0].pads.length, cantidadAntes + 1);
});

test("actualizarPad modifica propiedades manteniendo el resto", () => {
  let estado = crearEstadoInicial(1);
  const idPestana = estado.pestanaActivaId;
  estado = agregarPad(estado, idPestana);
  const idPad = estado.pestañas[0].pads[0].idPad;
  const nombreNuevo = "Audio prueba";
  estado = actualizarPad(estado, idPestana, idPad, { nombreArchivo: nombreNuevo });
  assert.equal(estado.pestañas[0].pads[0].nombreArchivo, nombreNuevo);
});

test("formatearTiempo devuelve mm:ss", () => {
  assert.equal(formatearTiempo(0), "00:00");
  assert.equal(formatearTiempo(75), "01:15");
});

test("calcularBorde aclara el color base", () => {
  const base = paletaColores[0];
  const borde = calcularBorde(base);
  assert.notEqual(base, borde);
  assert.ok(borde.startsWith("rgb"));
});
