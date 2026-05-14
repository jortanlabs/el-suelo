// scripts/marcar-infantiles.mjs
// Añade `paraNinos: true` a las subcategorías de cine/mundo que se consideran
// aptas para el modo infantil. Idempotente: si ya está, no toca.

import { readFileSync, writeFileSync } from "node:fs";

const ninos = new Set([
  // Cine — animación / mundos para niños
  "disney-personajes", "disney-villanos", "pixar", "dreamworks", "ghibli",
  "pokemon", "nickelodeon", "cartoon-network", "animacion-espanola",
  // Geografía
  "geo-banderas", "geo-paises", "geo-capitales",
  // Naturaleza
  "animales-mamiferos", "animales-maritimos", "animales-aves", "animales-insectos",
  "plantas-arboles", "plantas-flores", "plantas-frutos",
  // Personas reconocibles
  "personas-cuerpo", "personas-pelo", "personas-emociones", "personas-familia",
  // Marcas reconocibles
  "marcas-logos", "marcas-juguetes",
]);

for (const path of ["src/data/cine/nombres.ts", "src/data/mundo/nombres.ts"]) {
  let txt = readFileSync(path, "utf8");
  let total = 0;
  for (const slug of ninos) {
    // Encuentra el objeto que contiene `slug: "X"` y captura hasta su cierre `},`
    const re = new RegExp(`(\\{[^{}]*slug:\\s*"${slug}"[^{}]*?)(\\n\\s*\\},)`, "m");
    const m = txt.match(re);
    if (!m) continue;
    if (m[1].includes("paraNinos")) continue;
    const nuevo = m[1] + "\n    paraNinos: true," + m[2];
    txt = txt.replace(re, nuevo);
    total++;
  }
  writeFileSync(path, txt, "utf8");
  console.log(`${path}: ${total} subcats marcadas`);
}
