import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rutaIndex = join(process.cwd(), "index.html");

test("el placeholder '+' para crear pad está presente en el HTML inicial", () => {
  const contenido = readFileSync(rutaIndex, "utf-8");
  assert.match(
    contenido,
    /class="pad placeholder-vacio[^"]*"[^>]*>\s*<div class="pad-nombre">\s*<span[^>]*>＋<\/span>\s*Añadir pad/i,
    "El HTML inicial debe contener un pad vacío con el signo ＋ visible"
  );
});
