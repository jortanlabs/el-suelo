/**
 * Resolver de imágenes para el catálogo de El Mundo.
 *
 * Uso:
 *   npx tsx scripts/resolver-mundo.ts                 # resuelve solo items nuevos
 *   npx tsx scripts/resolver-mundo.ts geo-banderas    # solo una subcategoría
 *   npx tsx scripts/resolver-mundo.ts --force         # re-resuelve aunque ya exista
 *
 * Modo incremental (por defecto): lee el JSON existente y solo resuelve
 * los items que no tienen imagen todavía. Los items existentes se conservan.
 *
 * Requiere Node 22+ (fetch nativo).
 */

import { subcategoriasMundo, type SubcategoriaNombres } from "../src/data/mundo/nombres.ts";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../public/data/mundo");
const DELAY_MS = 150;

interface ItemResuelto {
  nombre: string;
  imagen: string;
  palabraClave: string;
}

// ── Utilidades ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "i",
  "of", "the", "a", "an", "le", "les", "en", "con",
]);

function displayName(nombre: string): string {
  return nombre.replace(/\s*\(.*?\)\s*/g, "").trim();
}

function palabraClaveDe(nombre: string): string {
  const display = displayName(nombre);
  const palabras = display
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/);
  for (let i = palabras.length - 1; i >= 0; i--) {
    if (!STOPWORDS.has(palabras[i])) return palabras[i];
  }
  return palabras[palabras.length - 1] ?? display.toLowerCase();
}

function normalizeImageUrl(url: string): string {
  return url
    .replace(/\/\d+px-/, "/")
    .replace(/\?.*$/, "")
    .toLowerCase();
}

// ── Wikipedia API ──────────────────────────────────────────────────────────

const USER_AGENT = "el-suelo-resolver/1.0 (https://github.com/jortanlabs/el-suelo)";

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function wikiSummary(title: string, lang: "es" | "en"): Promise<string | null> {
  const slug = encodeURIComponent(title.replace(/ /g, "_"));
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if ((data.type as string) === "disambiguation") return null;
    const thumb = data.thumbnail as Record<string, string> | undefined;
    const orig = data.originalimage as Record<string, string> | undefined;
    return thumb?.source ?? orig?.source ?? null;
  } catch {
    return null;
  }
}

async function wikiSearch(query: string, lang: "es" | "en"): Promise<string | null> {
  const url =
    `https://${lang}.wikipedia.org/w/api.php?` +
    `action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=3&origin=*`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
    const results = data.query?.search ?? [];
    for (const r of results) {
      const img = await wikiSummary(r.title, lang);
      if (img) return img;
      await sleep(DELAY_MS);
    }
  } catch {}
  return null;
}

/**
 * Busca imagen para un item.
 * Para banderas: antepone "Bandera de" al buscar para obtener la imagen de la bandera
 * en lugar de la ciudad capital u otro artículo del país.
 */
async function fetchImage(nombre: string, esBandera: boolean): Promise<string | null> {
  const display = displayName(nombre);

  if (esBandera) {
    // Buscar directamente el artículo de la bandera
    const queryEs = `Bandera de ${display}`;
    let img = await wikiSummary(queryEs, "es");
    if (img) return img;
    await sleep(DELAY_MS);

    const queryEn = `Flag of ${display}`;
    img = await wikiSummary(queryEn, "en");
    if (img) return img;
    await sleep(DELAY_MS);

    // Fallback: búsqueda
    img = await wikiSearch(queryEs, "es");
    if (img) return img;
    await sleep(DELAY_MS);
    img = await wikiSearch(queryEn, "en");
    if (img) return img;
    await sleep(DELAY_MS);
    return null;
  }

  // Búsqueda normal
  let img = await wikiSummary(nombre, "es");
  if (img) return img;
  await sleep(DELAY_MS);

  if (display !== nombre) {
    img = await wikiSummary(display, "es");
    if (img) return img;
    await sleep(DELAY_MS);
  }

  img = await wikiSearch(nombre, "es");
  if (img) return img;
  await sleep(DELAY_MS);

  img = await wikiSummary(nombre, "en");
  if (img) return img;
  await sleep(DELAY_MS);

  img = await wikiSearch(nombre, "en");
  if (img) return img;
  await sleep(DELAY_MS);

  return null;
}

// ── Resolver una subcategoría (incremental) ────────────────────────────────

async function resolverSubcategoria(
  subcat: SubcategoriaNombres,
  force = false,
): Promise<void> {
  if (subcat.esMetaCategoria || !subcat.nombres || subcat.nombres.length === 0) return;

  const outputPath = path.join(OUTPUT_DIR, `${subcat.slug}.json`);
  const esBandera = subcat.slug === "geo-banderas";

  // Leer JSON existente (si hay)
  let existentes: ItemResuelto[] = [];
  try {
    const raw = await fs.readFile(outputPath, "utf-8");
    existentes = JSON.parse(raw);
  } catch {
    // No existe todavía
  }

  const existentesPorNombre = new Map<string, ItemResuelto>(
    existentes.map((it) => [it.nombre.toLowerCase(), it]),
  );

  // En modo --force, re-resolver todo; si no, solo los items nuevos
  const pendientes = force
    ? subcat.nombres
    : subcat.nombres.filter((n) => {
        const display = displayName(n).toLowerCase();
        return !existentesPorNombre.has(display);
      });

  if (pendientes.length === 0) {
    console.log(`  ⏩ ${subcat.slug}: todos los items ya resueltos (${existentes.length} items)`);
    return;
  }

  console.log(`\n📂 ${subcat.nombre}: ${pendientes.length} items nuevos de ${subcat.nombres.length} totales...`);

  const nuevos: ItemResuelto[] = [];
  const seenImages = new Set<string>(existentes.map((it) => normalizeImageUrl(it.imagen)));
  let resolved = 0;
  let failed = 0;
  const BATCH = 4;

  for (let i = 0; i < pendientes.length; i += BATCH) {
    const batch = pendientes.slice(i, i + BATCH);

    const results = await Promise.all(
      batch.map(async (nombre) => {
        const imagen = await fetchImage(nombre, esBandera);
        return { nombre, imagen };
      }),
    );

    for (const { nombre, imagen } of results) {
      const display = displayName(nombre);
      if (!imagen) {
        console.warn(`    ❌ Sin imagen: ${nombre}`);
        failed++;
        continue;
      }
      const norm = normalizeImageUrl(imagen);
      if (seenImages.has(norm)) {
        console.warn(`    ⚠️  Imagen duplicada: ${nombre}`);
        failed++;
        continue;
      }
      seenImages.add(norm);
      nuevos.push({ nombre: display, imagen, palabraClave: palabraClaveDe(nombre) });
      resolved++;
      process.stdout.write(`    ${resolved} resueltos / ${failed} fallidos...\r`);
    }
  }

  console.log(`    ✅ ${resolved} nuevos, ${failed} sin imagen — total: ${existentes.length + resolved}`);

  // Merge: conservar existentes + añadir nuevos (en orden del catálogo)
  const orden = new Map(subcat.nombres.map((n, i) => [displayName(n).toLowerCase(), i]));
  const merged = [...(force ? [] : existentes), ...nuevos].sort((a, b) => {
    const ia = orden.get(a.nombre.toLowerCase()) ?? 9999;
    const ib = orden.get(b.nombre.toLowerCase()) ?? 9999;
    return ia - ib;
  });

  await fs.writeFile(outputPath, JSON.stringify(merged, null, 2), "utf-8");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const targetSlug = args.find((a) => !a.startsWith("--"));

  const toProcess = targetSlug
    ? subcategoriasMundo.filter((s) => s.slug === targetSlug)
    : subcategoriasMundo.filter((s) => !s.esMetaCategoria && !!s.nombres);

  if (toProcess.length === 0) {
    console.error(`❌ No se encontró la subcategoría "${targetSlug}".`);
    console.error(
      "Slugs disponibles:",
      subcategoriasMundo.filter((s) => !s.esMetaCategoria).map((s) => s.slug).join(", "),
    );
    process.exit(1);
  }

  const modo = force ? "(modo --force: re-resuelve todo)" : "(modo incremental: solo items nuevos)";
  console.log(`🌍 Resolviendo ${toProcess.length} subcategoría(s)... ${modo}\n`);

  for (const subcat of toProcess) {
    await resolverSubcategoria(subcat, force);
  }

  console.log("\n✅ Resolución completada.");
  console.log(`📁 JSONs en: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
