// scripts/limpiar-basket-acb.mjs
// Limpia basket-acb.json:
//   - aplica renames a nombres canónicos (sin patrocinadores, sin "Basket"/"Baloncesto" duplicado)
//   - quita equipos no-ACB (descendidos hace años, segunda división)
//   - extrae jugadores y los mueve a basket-leyendas.json
//   - dedupe por nombre conservando la entrada con imagen no vacía

import { readFileSync, writeFileSync } from "node:fs";

const ACB = "public/data/mundo/basket-acb.json";
const LEY = "public/data/mundo/basket-leyendas.json";

const renames = {
  "Real Madrid Basket": "Real Madrid Baloncesto",
  "FC Barcelona Basket": "FC Barcelona Baloncesto",
  "TD Systems Baskonia": "Baskonia",
  "Gran Canaria Claro": "Gran Canaria",
  "Club Baloncesto San Pablo Burgos": "San Pablo Burgos",
  "Hereda San Pablo Burgos": "San Pablo Burgos",
  "Basquet Manresa": "BAXI Manresa",
  "ICL Manresa": "BAXI Manresa",
  "Joventut": "Joventut Badalona",
  "Murcia UCAM": "UCAM Murcia",
  "Basquet Girona": "Bàsquet Girona",
  "Spar Citylift Girona": "Bàsquet Girona",
  "Movistar Estudiantes": "Estudiantes",
  "Surne Bilbao Basket": "Bilbao Basket",
  "CB Granada": "Covirán Granada",
};

const fuera = new Set([
  "Carplus Fuenlabrada",       // descendido hace años
  "Hierros Díaz Miranda",      // Miranda de Ebro juega en LEB, no ACB
]);

const jugadores = new Set([
  "Sergio Llull", "Walter Tavares", "Mario Hezonja", "Facundo Campazzo",
  "Tomáš Satoranský", "Nikola Mirotic", "Álex Abrines", "Vincent Poirier",
  "Nicolás Laprovittola", "Jan Veselý", "Alberto Abalde", "Carlos Alocén",
  "Usman Garuba", "Yannick Nzosa", "Santi Yusta", "Jaime Fernández",
  "Jaime Pradilla", "Lorenzo Brown", "Edy Tavares", "Olek Balcerowski",
]);

function dedup(arr) {
  const porNombre = new Map();
  for (const it of arr) {
    if (!porNombre.has(it.nombre)) porNombre.set(it.nombre, []);
    porNombre.get(it.nombre).push(it);
  }
  const limpio = [];
  const vistos = new Set();
  for (const it of arr) {
    if (vistos.has(it.nombre)) continue;
    const grupo = porNombre.get(it.nombre);
    const mejor = grupo.find((x) => x.imagen && x.imagen.length > 0) ?? grupo[0];
    limpio.push(mejor);
    vistos.add(it.nombre);
  }
  return limpio;
}

const acb = JSON.parse(readFileSync(ACB, "utf8"));
const leyendas = JSON.parse(readFileSync(LEY, "utf8"));

// 1. Separar equipos y jugadores
const equipos = [];
const jugadoresExtraidos = [];
for (const it of acb) {
  if (jugadores.has(it.nombre)) jugadoresExtraidos.push(it);
  else equipos.push(it);
}

// 2. Aplicar renames + quitar fuera
const equiposLimpios = equipos
  .filter((it) => !fuera.has(it.nombre))
  .map((it) => ({ ...it, nombre: renames[it.nombre] ?? it.nombre }));

// 3. Dedup
const acbFinal = dedup(equiposLimpios);

// 4. Añadir jugadores únicos a basket-leyendas
const leyendasNombresSet = new Set(leyendas.map((l) => l.nombre));
const yaEstaban = [];
const nuevos = [];
for (const j of jugadoresExtraidos) {
  if (leyendasNombresSet.has(j.nombre)) yaEstaban.push(j.nombre);
  else { nuevos.push(j); leyendasNombresSet.add(j.nombre); }
}
const leyendasFinal = [...leyendas, ...nuevos];

// 5. Escribir
writeFileSync(ACB, JSON.stringify(acbFinal, null, 2) + "\n", "utf8");
writeFileSync(LEY, JSON.stringify(leyendasFinal, null, 2) + "\n", "utf8");

// 6. Report
console.log(`basket-acb.json:`);
console.log(`  Antes: ${acb.length} entradas`);
console.log(`  Renombrados: ${equiposLimpios.filter((it) => renames[acb.find(a=>a.nombre===it.nombre)?.nombre]).length}`);
console.log(`  Quitados (no-ACB): ${equipos.length - equiposLimpios.length}  →  ${[...fuera].join(", ")}`);
console.log(`  Jugadores extraídos: ${jugadoresExtraidos.length}`);
console.log(`  Después (dedup): ${acbFinal.length}`);
console.log(`\nEquipos finales en basket-acb:`);
for (const e of acbFinal) console.log(`  · ${e.nombre}`);

console.log(`\nbasket-leyendas.json:`);
console.log(`  Antes: ${leyendas.length}  Después: ${leyendasFinal.length}`);
console.log(`  Nuevos: ${nuevos.length}  →  ${nuevos.map((x) => x.nombre).join(", ")}`);
if (yaEstaban.length) console.log(`  Ya estaban (descartados): ${yaEstaban.join(", ")}`);
