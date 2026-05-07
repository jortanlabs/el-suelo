/**
 * Resolver de imágenes para el catálogo de Cine y Series.
 *
 * Uso:
 *   npx tsx scripts/resolver-cine.ts                  # resuelve todo
 *   npx tsx scripts/resolver-cine.ts disney-personajes # solo una subcategoría
 *   npx tsx scripts/resolver-cine.ts --force           # re-resuelve aunque ya exista JSON
 *
 * Requiere Node 22+ (fetch nativo).
 * Si hay TMDB_TOKEN en el entorno lo usará para actores/directores reales.
 */

import { subcategorias, type SubcategoriaNombres } from "../src/data/cine/nombres.ts";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "../public/data/cine");
const DELAY_MS = 120; // ms entre peticiones para no saturar Wikipedia

interface ItemResuelto {
  nombre: string;
  imagen: string;
  palabraClave: string;
}

// ── Utilidades de nombres ──────────────────────────────────────────────────

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

// ── Resolución de imágenes ─────────────────────────────────────────────────

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
    }
  } catch {}
  return null;
}

async function fetchWikipediaImage(nombre: string): Promise<string | null> {
  // 1. Prueba título directo en español
  let img = await wikiSummary(nombre, "es");
  if (img) return img;
  await sleep(DELAY_MS);

  // 2. Prueba solo el displayName en español (sin paréntesis)
  const display = displayName(nombre);
  if (display !== nombre) {
    img = await wikiSummary(display, "es");
    if (img) return img;
    await sleep(DELAY_MS);
  }

  // 3. Búsqueda en español
  img = await wikiSearch(nombre, "es");
  if (img) return img;
  await sleep(DELAY_MS);

  // 4. Prueba título directo en inglés
  img = await wikiSummary(nombre, "en");
  if (img) return img;
  await sleep(DELAY_MS);

  // 5. Búsqueda en inglés
  img = await wikiSearch(nombre, "en");
  if (img) return img;
  await sleep(DELAY_MS);

  return null;
}

async function fetchTmdbImage(name: string, token: string): Promise<string | null> {
  const url =
    `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&language=es-ES`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ profile_path?: string }>;
    };
    const profilePath = data.results?.[0]?.profile_path;
    if (profilePath) return `https://image.tmdb.org/t/p/w500${profilePath}`;
  } catch {}
  return null;
}

// ── Deduplicación de imágenes ──────────────────────────────────────────────

function normalizeImageUrl(url: string): string {
  return url
    .replace(/\/\d+px-/, "/")
    .replace(/\?.*$/, "")
    .toLowerCase();
}

// ── Resolver una subcategoría ──────────────────────────────────────────────

async function resolverSubcategoria(
  subcat: SubcategoriaNombres,
  tmdbToken?: string,
  force = false,
): Promise<void> {
  if (subcat.esMetaCategoria || !subcat.nombres || subcat.nombres.length === 0) return;

  const outputPath = path.join(OUTPUT_DIR, `${subcat.slug}.json`);

  if (!force) {
    try {
      await fs.access(outputPath);
      console.log(`  ⏩ ${subcat.slug} ya resuelto, saltando (usa --force para re-resolver)`);
      return;
    } catch {}
  }

  console.log(`\n📂 ${subcat.nombre} (${subcat.nombres.length} items)...`);

  const items: ItemResuelto[] = [];
  const seenImages = new Set<string>();
  const BATCH = 5;
  let resolved = 0;
  let failed = 0;

  for (let i = 0; i < subcat.nombres.length; i += BATCH) {
    const batch = subcat.nombres.slice(i, i + BATCH);

    const results = await Promise.all(
      batch.map(async (nombre) => {
        const display = displayName(nombre);
        let imagen: string | null = null;

        // Para personas reales: TMDB primero
        if (subcat.usarTmdb && tmdbToken) {
          imagen = await fetchTmdbImage(display, tmdbToken);
        }

        // Fallback a Wikipedia
        if (!imagen) {
          imagen = await fetchWikipediaImage(nombre);
        }

        return { nombre, imagen };
      }),
    );

    for (const { nombre, imagen } of results) {
      if (!imagen) {
        console.warn(`    ❌ Sin imagen: ${nombre}`);
        failed++;
        continue;
      }

      // Deduplicar por URL normalizada
      const norm = normalizeImageUrl(imagen);
      if (seenImages.has(norm)) {
        console.warn(`    ⚠️  Imagen duplicada descartada: ${nombre}`);
        failed++;
        continue;
      }
      seenImages.add(norm);

      items.push({
        nombre: displayName(nombre),
        imagen,
        palabraClave: palabraClaveDe(nombre),
      });
      resolved++;
    }

    process.stdout.write(`    ${resolved} resueltos / ${failed} fallidos...\r`);
  }

  console.log(`    ✅ ${resolved} resueltos, ${failed} sin imagen o duplicados`);
  await fs.writeFile(outputPath, JSON.stringify(items, null, 2), "utf-8");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const tmdbToken = process.env.TMDB_TOKEN ?? process.env.PUBLIC_TMDB_TOKEN;
  if (!tmdbToken) {
    console.warn(
      "⚠️  No hay TMDB_TOKEN en el entorno. Actores y directores usarán Wikipedia como fallback.\n" +
        "    Para mejores resultados: TMDB_TOKEN=xxxx npx tsx scripts/resolver-cine.ts\n",
    );
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const targetSlug = args.find((a) => !a.startsWith("--"));

  const toProcess = targetSlug
    ? subcategorias.filter((s) => s.slug === targetSlug)
    : subcategorias.filter((s) => !s.esMetaCategoria && !!s.nombres);

  if (toProcess.length === 0) {
    if (targetSlug) {
      console.error(`❌ No se encontró la subcategoría "${targetSlug}".`);
      console.error(
        "Slugs disponibles:",
        subcategorias
          .filter((s) => !s.esMetaCategoria)
          .map((s) => s.slug)
          .join(", "),
      );
    } else {
      console.error("❌ No hay subcategorías que resolver.");
    }
    process.exit(1);
  }

  console.log(`🎬 Resolviendo ${toProcess.length} subcategorías...\n`);

  for (const subcat of toProcess) {
    await resolverSubcategoria(subcat, tmdbToken, force);
  }

  console.log("\n✅ Resolución completada.");
  console.log(`📁 JSONs guardados en: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
