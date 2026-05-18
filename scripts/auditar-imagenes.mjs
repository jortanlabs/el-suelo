// Auditoría de URLs de imagen del catálogo.
// - Hace HEAD a cada URL con timeout y concurrencia.
// - Marca como "borrar" las que dan error HTTP, timeout, devuelven HTML, o
//   están en HOSTS_INESTABLES (hosts conocidos por caducar las URLs).
// - Modifica los JSON dejando `imagen: ""` en los ítems marcados (el item
//   sigue en /preview para que el usuario suba una foto nueva).
// - Escribe un informe en referencia/imagenes-rotas.md del workspace padre.
//
// Uso: node scripts/auditar-imagenes.mjs [--dry-run] [--solo-host=hostname]
//   --dry-run         no escribe en JSON ni informe, solo imprime stats.
//   --solo-host=X     limita el chequeo a URLs cuyo hostname sea X.
//   --skip-net        no hace HEAD, solo marca las HOSTS_INESTABLES.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIRS = [path.join(ROOT, "public/data/cine"), path.join(ROOT, "public/data/mundo")];

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipNet = args.has("--skip-net");
const soloHost = [...args].find((a) => a.startsWith("--solo-host="))?.split("=")[1];

const CONCURRENCIA = 14;
const TIMEOUT_MS = 9000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; el-suelo audit; +https://elsuelo.es) tania@jortanlabs.com",
  "Accept": "image/*,*/*;q=0.5",
};

// Hosts que caducan/rotan sus URLs por diseño — marcar como "borrar" sin red.
const HOSTS_INESTABLES = new Set([
  "encrypted-tbn0.gstatic.com",
]);

// Motivos que se consideran "indeterminados": rate-limit, timeout, errores de
// red puntuales y 5xx. Vamos a reintentarlos uno a uno con pausa para no
// borrar URLs que en realidad solo nos estaban rate-limiteando.
const MOTIVOS_INDETERMINADOS = new Set([
  "http-429", "http-500", "http-502", "http-503", "http-504",
  "timeout", "error-red",
]);

function leerJsons() {
  const archivos = [];
  for (const dir of DATA_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      archivos.push(path.join(dir, f));
    }
  }
  return archivos;
}

function hostnameDe(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

async function comprobarUrl(url) {
  const host = hostnameDe(url);
  if (!host) return { ok: false, motivo: "url-invalida", host: null };
  if (HOSTS_INESTABLES.has(host)) return { ok: false, motivo: "host-inestable", host };
  if (skipNet) return { ok: true, host, motivo: "skip-net" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow", headers: HEADERS });
    if (res.status === 405 || res.status === 501 || (res.status === 403 && (res.headers.get("content-type") || "").startsWith("text/"))) {
      // Algunos hosts no aceptan HEAD bien — probamos GET parcial
      res = await fetch(url, { method: "GET", signal: ctrl.signal, redirect: "follow", headers: { ...HEADERS, Range: "bytes=0-1023" } });
    }
    if (!res.ok) return { ok: false, motivo: `http-${res.status}`, host };
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct && ct.startsWith("text/html")) return { ok: false, motivo: "devuelve-html", host };
    return { ok: true, host, motivo: ct.split(";")[0] || "ok" };
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, motivo: "timeout", host };
    return { ok: false, motivo: "error-red", host, detalle: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

async function ejecutarConPool(tareas, n) {
  const resultados = new Array(tareas.length);
  let i = 0;
  async function worker() {
    while (i < tareas.length) {
      const idx = i++;
      resultados[idx] = await tareas[idx]();
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return resultados;
}

// ── Carga ──────────────────────────────────────────────────────────
const archivos = leerJsons();
const items = []; // { archivoIdx, itemIdx, url, host, nombre, subcat }
for (let aIdx = 0; aIdx < archivos.length; aIdx++) {
  const archivo = archivos[aIdx];
  const subcat = path.basename(archivo, ".json");
  const data = JSON.parse(fs.readFileSync(archivo, "utf8"));
  for (let i = 0; i < data.length; i++) {
    const url = data[i]?.imagen;
    if (!url) continue;
    const host = hostnameDe(url);
    if (soloHost && host !== soloHost) continue;
    items.push({ archivoIdx: aIdx, itemIdx: i, url, host, nombre: data[i].nombre, subcat });
  }
}
console.log(`Archivos: ${archivos.length} · ítems con imagen a comprobar: ${items.length}`);
if (soloHost) console.log(`Filtrado a host: ${soloHost}`);

// ── Chequeo en paralelo ────────────────────────────────────────────
const inicio = Date.now();
let avanzados = 0;
const tareas = items.map((it) => async () => {
  const r = await comprobarUrl(it.url);
  avanzados++;
  if (avanzados % 200 === 0) {
    const seg = ((Date.now() - inicio) / 1000).toFixed(0);
    process.stdout.write(`\r${avanzados}/${items.length} (${seg}s)... `);
  }
  return { ...it, ...r };
});
const primerPase = await ejecutarConPool(tareas, CONCURRENCIA);
console.log(`\nPrimer pase: ${((Date.now() - inicio) / 1000).toFixed(0)}s`);

// ── Segundo pase para indeterminados ────────────────────────────────
// Wikipedia y similares aplican rate-limit a la IP del script. No queremos
// borrar URLs solo porque la API nos limitó. Reintentamos los indeterminados
// uno a uno con pausa de 1.5s entre cada uno.
const indeterminados = primerPase.filter((r) => !r.ok && MOTIVOS_INDETERMINADOS.has(r.motivo));
console.log(`Indeterminados a reintentar: ${indeterminados.length}`);
const reintentados = new Map(); // url → resultado nuevo
if (indeterminados.length > 0 && !skipNet) {
  const t2 = Date.now();
  for (let i = 0; i < indeterminados.length; i++) {
    const it = indeterminados[i];
    const r = await comprobarUrl(it.url);
    reintentados.set(it.url, r);
    if ((i + 1) % 50 === 0) {
      process.stdout.write(`\r  reintento ${i + 1}/${indeterminados.length}... `);
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
  console.log(`\nSegundo pase: ${((Date.now() - t2) / 1000).toFixed(0)}s`);
}

const resultados = primerPase.map((r) => {
  const nuevo = reintentados.get(r.url);
  if (!nuevo) return r;
  // Si tras reintento es OK, marcamos OK. Si sigue siendo indeterminado,
  // somos conservadores: lo dejamos OK (no borrar — preferimos falso negativo
  // a borrar una foto buena). Solo borramos si el segundo pase devuelve un
  // motivo definitivo (404, 403, devuelve-html...).
  if (nuevo.ok) return { ...r, ok: true, motivo: "ok-2do-pase", host: r.host };
  if (MOTIVOS_INDETERMINADOS.has(nuevo.motivo)) {
    return { ...r, ok: true, motivo: `indeterminado-${nuevo.motivo}`, host: r.host };
  }
  return { ...r, ok: false, motivo: `2do-${nuevo.motivo}`, host: r.host };
});

// ── Análisis ───────────────────────────────────────────────────────
const rotos = resultados.filter((r) => !r.ok);
const porMotivo = {};
const porHost = {};
for (const r of rotos) {
  porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
  porHost[r.host || "<sin-host>"] = (porHost[r.host || "<sin-host>"] || 0) + 1;
}
console.log(`\n=== Resumen ===`);
console.log(`Items revisados: ${items.length}`);
console.log(`Items a borrar:  ${rotos.length} (${((rotos.length / items.length) * 100).toFixed(1)}%)`);
console.log(`\nMotivos:`);
for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(5)} ${m}`);
}
console.log(`\nTop 15 hosts problemáticos:`);
for (const [h, n] of Object.entries(porHost).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${n.toString().padStart(5)} ${h}`);
}

// Desglose por subcategoría
const porSubcat = {};
for (const r of rotos) {
  if (!porSubcat[r.subcat]) porSubcat[r.subcat] = [];
  porSubcat[r.subcat].push(r);
}
const subcatTotales = {};
for (const it of items) {
  subcatTotales[it.subcat] = (subcatTotales[it.subcat] || 0) + 1;
}
console.log(`\n=== Subcategorías más afectadas ===`);
const subcatRanking = Object.entries(porSubcat)
  .map(([s, arr]) => ({ s, rotos: arr.length, total: subcatTotales[s] || 0 }))
  .sort((a, b) => b.rotos - a.rotos);
for (const { s, rotos, total } of subcatRanking.slice(0, 20)) {
  console.log(`  ${rotos.toString().padStart(3)}/${total.toString().padEnd(3)} ${s}`);
}

if (dryRun) {
  console.log(`\n[dry-run] No se escribe nada en JSON ni informe.`);
  process.exit(0);
}

// ── Aplicar borrado en JSON ────────────────────────────────────────
const porArchivo = {};
for (const r of rotos) {
  if (!porArchivo[r.archivoIdx]) porArchivo[r.archivoIdx] = [];
  porArchivo[r.archivoIdx].push(r.itemIdx);
}
let archivosTocados = 0;
for (const [aIdxStr, idxs] of Object.entries(porArchivo)) {
  const aIdx = Number(aIdxStr);
  const archivo = archivos[aIdx];
  const data = JSON.parse(fs.readFileSync(archivo, "utf8"));
  for (const i of idxs) {
    if (data[i]) data[i].imagen = "";
  }
  fs.writeFileSync(archivo, JSON.stringify(data, null, 2) + "\n");
  archivosTocados++;
}
console.log(`\nJSON modificados: ${archivosTocados}`);

// Calcula cuántas imágenes quedan por subcategoría tras el borrado
const restantesPorSubcat = {};
for (const archivo of archivos) {
  const subcat = path.basename(archivo, ".json");
  const data = JSON.parse(fs.readFileSync(archivo, "utf8"));
  restantesPorSubcat[subcat] = data.filter((it) => !!it.imagen).length;
}
// Subcats que tenían ≥8 imágenes antes y caen a <8 tras el borrado.
const subcatsRiesgo = [];
for (const archivo of archivos) {
  const subcat = path.basename(archivo, ".json");
  const total = subcatTotales[subcat] || 0;
  const restantes = restantesPorSubcat[subcat];
  if (total >= 8 && restantes < 8) {
    subcatsRiesgo.push({ s: subcat, antes: total, despues: restantes });
  }
}

// ── Informe ────────────────────────────────────────────────────────
const reportPath = path.resolve(ROOT, "..", "referencia", "imagenes-rotas.md");
const lineas = [];
lineas.push(`# Auditoría de imágenes — ${new Date().toISOString().slice(0, 10)}`);
lineas.push(``);
lineas.push(`Recorrido automatizado con HEAD sobre las URLs de \`imagen\` de los JSON del catálogo. Las URLs identificadas se han **vaciado** (campo \`imagen: ""\`) en el JSON correspondiente — el item sigue visible en \`/preview\` para sustituir la foto desde el panel de Tania.`);
lineas.push(``);
lineas.push(`## Resumen`);
lineas.push(``);
lineas.push(`- Items revisados: **${items.length}**`);
lineas.push(`- Items vaciados: **${rotos.length}** (${((rotos.length / items.length) * 100).toFixed(1)}%)`);
if (subcatsRiesgo.length > 0) {
  lineas.push(``);
  lineas.push(`## ⚠️ Subcategorías que han caído bajo el umbral (8 imágenes)`);
  lineas.push(``);
  lineas.push(`Tras la auditoría, estas subcategorías **dejarán de aparecer en el juego** hasta que repongas fotos (\`listas.json\` filtra subcategorías con menos de 8 ítems con imagen):`);
  lineas.push(``);
  lineas.push(`| Subcategoría | Antes | Ahora | Faltan para volver |`);
  lineas.push(`|---|---:|---:|---:|`);
  for (const { s, antes, despues } of subcatsRiesgo.sort((a, b) => a.despues - b.despues)) {
    lineas.push(`| ${s} | ${antes} | ${despues} | ${8 - despues} |`);
  }
}
lineas.push(``);
lineas.push(`### Motivos`);
lineas.push(``);
lineas.push(`| Motivo | Cantidad |`);
lineas.push(`|---|---:|`);
for (const [m, n] of Object.entries(porMotivo).sort((a, b) => b[1] - a[1])) {
  lineas.push(`| ${m} | ${n} |`);
}
lineas.push(``);
lineas.push(`### Hosts más problemáticos`);
lineas.push(``);
lineas.push(`| Host | Cantidad |`);
lineas.push(`|---|---:|`);
for (const [h, n] of Object.entries(porHost).sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  lineas.push(`| ${h} | ${n} |`);
}
lineas.push(``);
lineas.push(`## Detalle por subcategoría`);
lineas.push(``);
for (const { s, rotos, total } of subcatRanking) {
  lineas.push(`### ${s} — ${rotos}/${total} vaciados`);
  lineas.push(``);
  lineas.push(`| Ítem | Motivo | Host |`);
  lineas.push(`|---|---|---|`);
  for (const r of porSubcat[s]) {
    lineas.push(`| ${r.nombre} | ${r.motivo} | ${r.host || "—"} |`);
  }
  lineas.push(``);
}
fs.writeFileSync(reportPath, lineas.join("\n"));
console.log(`Informe: ${reportPath}`);
