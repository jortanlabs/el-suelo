// scripts/generar-og.mjs
// Convierte public/og.svg → public/og.png (1200x630) en cada build.
// Se ejecuta antes de astro build (ver script "prebuild" en package.json).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const SVG = "public/og.svg";
const PNG = "public/og.png";

if (!existsSync(SVG)) {
  console.warn(`No existe ${SVG}, salto la generación de OG.`);
  process.exit(0);
}

const svg = readFileSync(SVG, "utf8");
// Imagen cuadrada 400x400: WhatsApp con imágenes pequeñas (<600px) muestra
// el preview compacto tipo thumbnail a la izquierda del texto, no el banner
// grande encima.
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 400 },
  background: "#050c1e",
  font: { loadSystemFonts: true },
});
const buf = resvg.render().asPng();
writeFileSync(PNG, buf);
console.log(`og.png: ${buf.length} bytes`);
