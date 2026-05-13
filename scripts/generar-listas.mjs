// scripts/generar-listas.mjs
// Recorre los JSON de public/data/{cine,mundo}/ y genera public/data/listas.json
// con los slugs que tienen al menos UMBRAL items con imagen no vacía.
//
// Se ejecuta en `npm run build` (via prebuild). El juego en el cliente carga
// `listas.json` para construir el pool jugable, así una subcategoría que se
// publicó vacía (sin fotos) no aparece como opción.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const UMBRAL = 8;
const PUBLICADAS = "public/data/publicadas.json";
const OUT = "public/data/listas.json";

if (!existsSync(PUBLICADAS)) {
  console.warn(`No existe ${PUBLICADAS}; escribiendo lista vacía en ${OUT}.`);
  writeFileSync(OUT, "[]\n", "utf8");
  process.exit(0);
}

const publicadas = JSON.parse(readFileSync(PUBLICADAS, "utf8"));
const listas = [];
const omitidas = [];

for (const slug of publicadas) {
  let path = join("public/data/cine", `${slug}.json`);
  if (!existsSync(path)) path = join("public/data/mundo", `${slug}.json`);
  if (!existsSync(path)) {
    omitidas.push({ slug, motivo: "no existe JSON" });
    continue;
  }
  let arr;
  try {
    arr = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    omitidas.push({ slug, motivo: `no parsea (${e.message})` });
    continue;
  }
  if (!Array.isArray(arr)) {
    omitidas.push({ slug, motivo: "no es array" });
    continue;
  }
  const conImg = arr.filter((it) => it && it.imagen && String(it.imagen).length > 0).length;
  if (conImg >= UMBRAL) {
    listas.push(slug);
  } else {
    omitidas.push({ slug, motivo: `solo ${conImg}/${arr.length} con imagen` });
  }
}

writeFileSync(OUT, JSON.stringify(listas, null, 2) + "\n", "utf8");

console.log(`listas.json: ${listas.length}/${publicadas.length} subcategorías cumplen ≥${UMBRAL} imágenes.`);
if (omitidas.length) {
  console.log(`Omitidas (${omitidas.length}):`);
  for (const { slug, motivo } of omitidas) console.log(`  · ${slug}: ${motivo}`);
}
