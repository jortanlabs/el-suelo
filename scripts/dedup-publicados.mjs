// scripts/dedup-publicados.mjs
// Detecta duplicados literales por campo "nombre" en todos los JSON de public/data/{mundo,cine}/.
// Por defecto solo lista. Con --apply rescribe los archivos manteniendo, para cada nombre, la
// entrada con `imagen` no vacía (si la hay), o la primera ocurrencia.
//
// Uso:
//   node scripts/dedup-publicados.mjs           # listar
//   node scripts/dedup-publicados.mjs --apply   # corregir in-place

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOTS = [
  "public/data/mundo",
  "public/data/cine",
];

let totalDups = 0;
const cambios = [];

for (const root of ROOTS) {
  let files;
  try {
    files = readdirSync(root).filter((f) => f.endsWith(".json") && f !== "publicadas.json");
  } catch {
    continue;
  }
  for (const f of files) {
    const path = join(root, f);
    let json;
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      console.error(`✗ No parsea: ${path} (${e.message})`);
      continue;
    }
    if (!Array.isArray(json)) continue;

    const porNombre = new Map();
    for (const it of json) {
      if (!it || typeof it.nombre !== "string") continue;
      const k = it.nombre;
      if (!porNombre.has(k)) porNombre.set(k, []);
      porNombre.get(k).push(it);
    }

    const dups = [...porNombre.entries()].filter(([_, arr]) => arr.length > 1);
    if (dups.length === 0) continue;

    const dupsTotales = dups.reduce((acc, [_, arr]) => acc + (arr.length - 1), 0);
    totalDups += dupsTotales;
    console.log(`\n${path}  (${dups.length} nombres con duplicados, ${dupsTotales} entradas sobrantes)`);
    for (const [nombre, arr] of dups) {
      const conImg = arr.filter((x) => x.imagen && x.imagen.length > 0).length;
      console.log(`  · ${nombre}  ×${arr.length}  (con imagen: ${conImg})`);
    }

    if (APPLY) {
      const limpio = [];
      const vistos = new Set();
      for (const it of json) {
        const k = it.nombre;
        if (vistos.has(k)) continue;
        const arr = porNombre.get(k);
        // si hay varios, escoger el primero CON imagen no vacía; si no, el primero
        const mejor = arr.find((x) => x.imagen && x.imagen.length > 0) ?? arr[0];
        limpio.push(mejor);
        vistos.add(k);
      }
      writeFileSync(path, JSON.stringify(limpio, null, 2) + "\n", "utf8");
      cambios.push(path);
    }
  }
}

console.log("\n" + "─".repeat(60));
if (totalDups === 0) {
  console.log("✓ Sin duplicados literales en JSON publicados.");
} else {
  console.log(`Total: ${totalDups} entradas duplicadas.`);
  if (APPLY) {
    console.log(`✏  Reescritos ${cambios.length} archivos.`);
  } else {
    console.log("(ejecuta de nuevo con --apply para corregir)");
  }
}
