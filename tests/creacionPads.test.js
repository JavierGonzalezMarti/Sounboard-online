import test from "node:test";
import assert from "node:assert/strict";
import { crearEstadoInicial, agregarPad, normalizarEstado } from "../scripts/estado.js";

test("se pueden crear múltiples pads vacíos consecutivos", () => {
  let estado = crearEstadoInicial(1);
  const idPestana = estado.pestanaActivaId;
  const cantidad = 5;
  for (let i = 0; i < cantidad; i += 1) {
    estado = agregarPad(estado, idPestana);
  }
  const pads = estado.pestañas.find((p) => p.idPestana === idPestana).pads;
  assert.equal(pads.length, cantidad, "Debe haberse creado un pad por cada click simulado");
  const idsUnicos = new Set(pads.map((p) => p.idPad));
  assert.equal(idsUnicos.size, cantidad, "Cada pad debe tener un id único");
  pads.forEach((pad) => {
    assert.equal(pad.nombreArchivo, "Vacío");
    assert.equal(pad.archivo, null);
  });
});

test("agregarPad funciona aunque la pestaña no tenga arreglo de pads (estado dañado)", () => {
  const estadoDañado = {
    pestañas: [{ idPestana: "p1", nombre: "P1", pads: null }],
    pestanaActivaId: "p1",
    columnas: 5,
    indiceColor: 0
  };
  let estado = normalizarEstado(estadoDañado);
  estado = agregarPad(estado, "p1");
  const pads = estado.pestañas[0].pads;
  assert.equal(pads.length, 1);
  assert.equal(pads[0].nombreArchivo, "Vacío");
});
