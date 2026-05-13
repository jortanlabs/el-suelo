/**
 * Cliente del navegador para "The Floor".
 * - Categorías predefinidas: SPARQL directo al navegador → Wikidata (evita bloqueos de IP de Vercel).
 * - Categoría libre: POST al endpoint /api/generar-floor (necesita Claude AI en servidor).
 * Cachea en localStorage 24h.
 */
import { resolverNombres, palabraClaveDe } from "./wikidata.ts";

export interface ItemFloor {
  nombre: string;
  imagen: string;
  palabraClave: string;
}

const TTL_MS = 24 * 60 * 60 * 1000;

function clave(slug: string | "libre", libre?: string): string {
  return slug === "libre"
    ? `juegario:floor:v3:libre:${(libre ?? "").toLowerCase()}`
    : `juegario:floor:v2:${slug}`;
}

function leerCache(k: string): ItemFloor[] | null {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: ItemFloor[]; expira: number };
    if (parsed.expira > Date.now() && Array.isArray(parsed.data)) return parsed.data;
    localStorage.removeItem(k);
  } catch {
    // JSON corrupto en localStorage — limpiar
    try { localStorage.removeItem(k); } catch {}
  }
  return null;
}

function guardarCache(k: string, data: ItemFloor[]): void {
  try {
    localStorage.setItem(
      k,
      JSON.stringify({ data, expira: Date.now() + TTL_MS }),
    );
  } catch {}
}

function deduplicar(items: ItemFloor[]): ItemFloor[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.imagen
      .replace(/\/\d+px-/g, "/")
      .replace(/\?.*$/, "")
      .toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── TMDB ────────────────────────────────────────────────────────────────────

type TMDBPerson = { name: string; profile_path: string | null; popularity: number };
type TMDBSearchResp = { results?: TMDBPerson[] };

async function resolverConTMDB(nombres: string[], paralelos = 6): Promise<ItemFloor[]> {
  const token = ((import.meta as unknown as { env: Record<string, string> }).env?.PUBLIC_TMDB_TOKEN) ?? "";
  if (!token) return [];
  const result: ItemFloor[] = [];
  for (let i = 0; i < nombres.length; i += paralelos) {
    const lote = nombres.slice(i, i + paralelos);
    const resueltos = await Promise.all(
      lote.map(async (nombre): Promise<ItemFloor | null> => {
        try {
          const url = `https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(nombre)}&language=en-US&page=1`;
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, accept: "application/json" } });
          if (!res.ok) return null;
          const data = (await res.json()) as TMDBSearchResp;
          const conFoto = (data.results ?? []).filter((p) => p.profile_path);
          if (!conFoto.length) return null;
          const normNombre = norm(nombre);
          const exacto = conFoto.find((p) => norm(p.name) === normNombre);
          const mejor = exacto ?? conFoto.sort((a, b) => b.popularity - a.popularity)[0];
          if (!mejor.profile_path) return null;
          return { nombre, imagen: `https://image.tmdb.org/t/p/w500${mejor.profile_path}`, palabraClave: palabraClaveDe(nombre) };
        } catch { return null; }
      }),
    );
    for (const item of resueltos) if (item) result.push(item);
  }
  return result;
}

// ── Deezer ──────────────────────────────────────────────────────────────────

type DeezerArtist = { id: number; name: string; picture_xl: string; nb_fan: number };
type DeezerSearchResp = { data?: DeezerArtist[] };

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
}

const DEEZER_PLACEHOLDER = "d41d8cd98f00b204e9800998ecf8427e";

async function resolverConDeezer(nombres: string[], paralelos = 6): Promise<ItemFloor[]> {
  const result: ItemFloor[] = [];
  for (let i = 0; i < nombres.length; i += paralelos) {
    const lote = nombres.slice(i, i + paralelos);
    const resueltos = await Promise.all(
      lote.map(async (nombre): Promise<ItemFloor | null> => {
        try {
          const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(nombre)}&limit=5`;
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = (await res.json()) as DeezerSearchResp;
          if (!data.data?.length) return null;
          const normNombre = norm(nombre);
          const exacto = data.data.find((a) => norm(a.name) === normNombre);
          const artist = exacto ?? data.data.sort((a, b) => b.nb_fan - a.nb_fan)[0];
          if (!artist.picture_xl || artist.picture_xl.includes(DEEZER_PLACEHOLDER)) return null;
          return { nombre, imagen: artist.picture_xl, palabraClave: palabraClaveDe(nombre) };
        } catch { return null; }
      }),
    );
    for (const item of resueltos) if (item) result.push(item);
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────

export async function generarFloorPredefinida(
  slug: string,
  nombres: string[],
  ocupaciones?: string[],
  instancias?: string[],
  descripcion?: string[],
  apiEspecializada?: string,
): Promise<ItemFloor[]> {
  const k = clave(slug);
  const cached = leerCache(k);
  if (cached && cached.length > 0 && !cached[0].imagen.includes("Special:FilePath")) {
    return cached;
  }

  let items: ItemFloor[];

  if (apiEspecializada === "deezer" || apiEspecializada === "tmdb") {
    items = apiEspecializada === "deezer"
      ? await resolverConDeezer(nombres)
      : await resolverConTMDB(nombres);
    if (items.length < 8) {
      const encontrados = new Set(items.map((i) => i.nombre));
      const faltantes = nombres.filter((n) => !encontrados.has(n));
      const extra = await resolverNombres(faltantes, 5, ocupaciones, instancias, descripcion);
      items = [...items, ...extra];
    }
  } else {
    items = await resolverNombres(nombres, 5, ocupaciones, instancias, descripcion);
  }

  items = deduplicar(items);
  if (items.length < 8) throw new Error(`Solo se encontraron ${items.length} imágenes. Recarga para intentarlo de nuevo.`);
  guardarCache(k, items);
  return items;
}

type WpPagesResp = {
  query?: { pages?: Record<string, { title?: string; missing?: string; thumbnail?: { source?: string } }> };
};

type WpRestSummary = {
  type?: string;
  description?: string;
  thumbnail?: { source?: string };
};

/**
 * Resuelve imágenes para categorías libres.
 * El prompt de Claude genera nombres que coinciden con títulos de Wikipedia en inglés.
 *
 * Estrategia:
 * 1. REST summary directo EN (más rápido y fiable si el nombre = título exacto)
 * 2. REST summary directo ES
 * 3. generator=search EN (fallback para títulos aproximados)
 * 4. generator=search ES
 *
 * El nombre de display elimina el sufijo de desambiguación:
 * "Elsa (Frozen)" → muestra "Elsa", busca "Elsa (Frozen)".
 */
async function resolverConWikipedia(
  nombres: string[],
  paralelos = 8,
  categoriaHint?: string,
): Promise<ItemFloor[]> {
  const normStr = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
  // Palabras significativas de la categoría (≥4 letras) para filtrar resultados ambiguos
  const catWords = categoriaHint
    ? normStr(categoriaHint).split(/\s+/).filter((w) => w.length >= 4)
    : [];

  const result: ItemFloor[] = [];
  for (let i = 0; i < nombres.length; i += paralelos) {
    const lote = nombres.slice(i, i + paralelos);
    const resueltos = await Promise.all(
      lote.map(async (nombre): Promise<ItemFloor | null> => {
        const nombreDisplay = nombre.replace(/\s*\([^)]+\)\s*$/, "").trim() || nombre;
        const slug = nombre.replace(/ /g, "_");

        // Fase 1: REST summary directo
        for (const lang of ["en", "es"]) {
          try {
            const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
            const res = await fetch(url, { headers: { accept: "application/json" } });
            if (!res.ok) continue;
            const data = (await res.json()) as WpRestSummary;
            if (data.type === "disambiguation") continue;
            if (data.thumbnail?.source) {
              // Si hay pista de categoría, verifica que el artículo no sea una entidad
              // de dominio completamente diferente (ej: pájaro cuando se busca término de golf)
              if (catWords.length > 0) {
                const desc = normStr(data.description ?? "");
                const coincide = catWords.some((w) => desc.includes(w));
                // Solo descartamos si hay descripción Y ninguna palabra de la categoría aparece
                if (data.description && !coincide) continue;
              }
              return { nombre: nombreDisplay, imagen: data.thumbnail.source, palabraClave: palabraClaveDe(nombreDisplay) };
            }
          } catch {}
        }

        // Fase 2: generator=search — incluye la categoría en la query si está disponible
        const normNombre = normStr(nombre);
        const queryBase = categoriaHint ? `${nombre} ${categoriaHint}` : nombre;
        for (const lang of ["en", "es"]) {
          try {
            const url =
              `https://${lang}.wikipedia.org/w/api.php` +
              `?action=query&generator=search&gsrsearch=${encodeURIComponent(queryBase)}` +
              `&gsrlimit=5&prop=pageimages&pithumbsize=400&redirects=1&format=json&origin=*`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = (await res.json()) as WpPagesResp;
            const pages = Object.values(data.query?.pages ?? {})
              .filter((p) => !("missing" in p) && p.thumbnail?.source);
            if (pages.length === 0) continue;
            const ranked = pages.sort((a, b) => {
              const ta = normStr(a.title ?? ""); const tb = normStr(b.title ?? "");
              const sa = ta === normNombre ? 0 : ta.startsWith(normNombre) ? 1 : ta.includes(normNombre) ? 2 : 3;
              const sb = tb === normNombre ? 0 : tb.startsWith(normNombre) ? 1 : tb.includes(normNombre) ? 2 : 3;
              return sa - sb;
            });
            return { nombre: nombreDisplay, imagen: ranked[0].thumbnail!.source!, palabraClave: palabraClaveDe(nombreDisplay) };
          } catch {}
        }

        return null;
      }),
    );
    for (const item of resueltos) if (item) result.push(item);
  }
  return result;
}

export async function generarFloor(
  opts: { libre?: string; forzar?: boolean; onProgreso?: (msg: string) => void },
): Promise<ItemFloor[]> {
  if (!opts.libre) throw new Error("Falta libre");
  const k = clave("libre", opts.libre);
  if (!opts.forzar) {
    const cached = leerCache(k);
    if (cached && cached.length > 0 && !cached[0].imagen.includes("Special:FilePath")) return cached;
  }
  opts.onProgreso?.("✍️ Generando lista con IA...");
  const res = await fetch("/api/generar-floor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ libre: opts.libre }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Error ${res.status}`);
  }
  const data = (await res.json()) as { nombres?: string[] };
  if (!Array.isArray(data.nombres) || data.nombres.length === 0) {
    throw new Error("Sin items");
  }
  // Categorías de logos/marcas: Wikidata P154 devuelve el logo oficial (SVG libre en Commons)
  // en lugar de la foto del edificio o producto que devolvería Wikipedia
  const esLogo = /logo|logotipo|marca|brand|empresa|icono|corporat/i.test(opts.libre ?? "");
  if (esLogo) {
    opts.onProgreso?.(`🎨 Resolviendo logos en Wikidata (${data.nombres.length} marcas)...`);
    const logoItems = await resolverNombres(
      data.nombres, 5,
      undefined, undefined,
      ["company", "corporation", "brand", "empresa", "marca", "organization"],
      true, // P154 primero
    );
    if (logoItems.length >= 8) {
      guardarCache(k, logoItems);
      return logoItems;
    }
    // fallback a Wikipedia si Wikidata no tiene suficientes logos
  }

  opts.onProgreso?.(`🔍 Buscando imágenes (${data.nombres.length} items)...`);
  const wpItems = await resolverConWikipedia(data.nombres, 8, opts.libre);

  // Fallback Wikidata P18 para los que Wikipedia no resolvió
  const encontrados = new Set(wpItems.map((i) => i.nombre));
  const sinImagen = data.nombres.filter((n) => {
    const display = n.replace(/\s*\([^)]+\)\s*$/, "").trim() || n;
    return !encontrados.has(display);
  });
  let items = wpItems;
  if (sinImagen.length > 0) {
    opts.onProgreso?.(`🔍 Completando ${sinImagen.length} items desde Wikidata...`);
    const wdExtra = await resolverNombres(sinImagen, 5);
    items = [...wpItems, ...wdExtra];
  }

  items = deduplicar(items);
  if (items.length < 8) {
    throw new Error(`Solo se encontraron ${items.length} imágenes para esta categoría. Prueba con una categoría más específica o famosa.`);
  }
  guardarCache(k, items);
  return items;
}

// ── Catálogos pre-resueltos (Cine, Mundo…) ───────────────────────────────────

const TTL_CINE_MS = 60 * 60 * 1000; // 1 hora — los JSON se editan vía /preview, no podemos cachear demasiado

function claveCine(slug: string): string {
  return `juegario:cine:v3:${slug}`;
}

function claveMundo(slug: string): string {
  return `juegario:mundo:v2:${slug}`;
}

/**
 * Carga los items pre-resueltos de una subcategoría de Cine y Series.
 * Primero consulta localStorage; si no hay caché válida, fetcha el JSON estático.
 */
export async function cargarCatalogoCine(slug: string): Promise<ItemFloor[]> {
  const k = claveCine(slug);
  const cached = leerCache(k);
  if (cached && cached.length > 0) return cached;

  const res = await fetch(`/data/cine/${slug}.json`);
  if (!res.ok) throw new Error(`Categoría "${slug}" no encontrada`);
  const todos = (await res.json()) as ItemFloor[];
  const items = todos.filter((i) => !!i.imagen);
  if (!items.length) throw new Error(`La categoría "${slug}" está vacía`);

  try {
    localStorage.setItem(k, JSON.stringify({ data: items, expira: Date.now() + TTL_CINE_MS }));
  } catch {}

  return items;
}

/**
 * Carga los items pre-resueltos de una subcategoría de El Mundo.
 */
export async function cargarCatalogoMundo(slug: string): Promise<ItemFloor[]> {
  const k = claveMundo(slug);
  const cached = leerCache(k);
  if (cached && cached.length > 0) return cached;

  const res = await fetch(`/data/mundo/${slug}.json`);
  if (!res.ok) throw new Error(`Categoría "${slug}" no encontrada`);
  const todos = (await res.json()) as ItemFloor[];
  const items = todos.filter((i) => !!i.imagen);
  if (!items.length) throw new Error(`La categoría "${slug}" está vacía`);

  try {
    localStorage.setItem(k, JSON.stringify({ data: items, expira: Date.now() + TTL_CINE_MS }));
  } catch {}

  return items;
}

/**
 * Carga una categoría derivada de película: carga el JSON base y usa el contenido
 * entre paréntesis de cada nombre como respuesta, conservando la imagen del personaje.
 */
export async function cargarCatalogoCinePeli(derivedSlug: string, baseSlug: string): Promise<ItemFloor[]> {
  const k = claveCine(derivedSlug);
  const cached = leerCache(k);
  if (cached && cached.length > 0) return cached;

  const res = await fetch(`/data/cine/${baseSlug}.json`);
  if (!res.ok) throw new Error(`Categoría base "${baseSlug}" no encontrada`);
  const base = (await res.json()) as ItemFloor[];

  const items: ItemFloor[] = base
    .map((it) => {
      if (!it.imagen) return null;
      const m = it.nombre.match(/\(([^)]+)\)$/);
      if (!m) return null;
      const peli = m[1].trim();
      return { nombre: peli, imagen: it.imagen, palabraClave: palabraClaveDe(peli) };
    })
    .filter((it): it is ItemFloor => it !== null);

  if (!items.length) throw new Error(`La categoría "${derivedSlug}" no tiene entradas de película`);

  try {
    localStorage.setItem(k, JSON.stringify({ data: items, expira: Date.now() + TTL_CINE_MS }));
  } catch {}

  return items;
}

/**
 * Carga y mezcla items de varias subcategorías (para categorías "Mezcla").
 * Carga cada subcategoría en paralelo y baraja el resultado final.
 */
export async function cargarMezclaCine(slugs: string[]): Promise<ItemFloor[]> {
  const k = claveCine(`mezcla:${slugs.sort().join(",")}`);
  const cached = leerCache(k);
  if (cached && cached.length > 0) return cached;

  const todos = await Promise.all(slugs.map((s) => cargarCatalogoCine(s).catch(() => [] as ItemFloor[])));
  const items = deduplicar(todos.flat().sort(() => Math.random() - 0.5));

  try {
    localStorage.setItem(k, JSON.stringify({ data: items, expira: Date.now() + TTL_CINE_MS }));
  } catch {}

  return items;
}

const PUB_TTL_MS = 60 * 1000; // 1 minuto — para que cambios en /preview se vean rápido
const PUB_CACHE_KEY = "juegario:publicadas:v3";

// Lee listas.json (generado por scripts/generar-listas.mjs en build), que
// solo contiene las subcategorías con ≥8 items con imagen. Fallback a
// publicadas.json si no existe (deploys antiguos).
export async function cargarPublicadas(): Promise<string[]> {
  try {
    const raw = localStorage.getItem(PUB_CACHE_KEY);
    if (raw) {
      try {
        const { data, expira } = JSON.parse(raw);
        if (Date.now() < expira && Array.isArray(data)) return data;
      } catch { try { localStorage.removeItem(PUB_CACHE_KEY); } catch {} }
    }
    let res = await fetch("/data/listas.json");
    if (!res.ok) res = await fetch("/data/publicadas.json");
    if (!res.ok) return [];
    const data: string[] = await res.json();
    if (!Array.isArray(data)) return [];
    try { localStorage.setItem(PUB_CACHE_KEY, JSON.stringify({ data, expira: Date.now() + PUB_TTL_MS })); } catch {}
    return data;
  } catch { return []; }
}

/* ============ Reconocimiento de voz ============ */

export function navegadorSoportaVoz(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function aciertoContiene(
  transcripcion: string,
  palabraClave: string,
): boolean {
  const t = ` ${normalizar(transcripcion)} `;
  const k = ` ${normalizar(palabraClave)} `;
  if (k.trim().length === 0) return false;
  return t.includes(k);
}

const STOP = new Set(["de", "del", "la", "el", "los", "las", "y", "i", "of", "the", "a", "an", "le", "les", "en", "con", "sin"]);

function levenshtein(a: string, b: string, max = 1): number {
  if (Math.abs(a.length - b.length) > max) return 999;
  const m = a.length, n = b.length;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[n];
}

// Aproximación fonética castellana de una palabra inglesa.
// Cubre patrones típicos cuando el reconocedor (en español) transcribe inglés:
// - star → estar, spider → espider (prefijo "s+consonante" suena "es-")
// - wars → uars, kit → cit
// - hamburger → amburguer (h muda)
// - phone → fone
// - sully → suly, anna → ana, ross → ros (consonantes dobles colapsadas)
// - dory → dori, harry → hari (y final pronunciada como i en castellano)
function fonetizar(p: string): string {
  return p
    .replace(/^s([bcdfghjklmnpqrstvwxyz])/, "es$1")
    .replace(/w/g, "u")
    .replace(/k/g, "c")
    .replace(/^h/, "")
    .replace(/ph/g, "f")
    .replace(/(.)\1/g, "$1")
    .replace(/y$/, "i");
}

/**
 * Acepta si la transcripción contiene CUALQUIER palabra significativa del nombre.
 * Nivel 1: matching exacto de palabra completa.
 * Nivel 2: Levenshtein ≤ 1 para palabras de 5+ caracteres (cubre errores del reconocedor:
 *   "messy"→"messi", "ronald"→"ronaldo", "eifell"→"eiffel", etc.)
 */
// Expande una palabra de categoría con sus formas singular/plural más comunes
function formasCategoria(w: string): string[] {
  const f = [w];
  if (w.endsWith("es") && w.length > 4) f.push(w.slice(0, -2)); // flores→flor, animales→animal
  else if (w.endsWith("s") && w.length > 3) f.push(w.slice(0, -1)); // logos→logo, aves→ave
  f.push(w + "s", w + "es");
  return f;
}

// Subcategorías donde el contenido del paréntesis es una RESPUESTA ALTERNATIVA
// válida (autor de la obra), no un mero desambiguador. P.ej. en "Las Meninas
// (Velázquez)" el jugador puede acertar diciendo "Las Meninas" o "Velázquez".
// En el resto de categorías, el paréntesis sigue siendo contexto excluyente.
export const SLUGS_PARENTESIS_VALIDO: ReadonlySet<string> = new Set([
  "arte-cuadros",
  "arte-esculturas",
]);

export function aciertoFlexible(
  transcripcion: string,
  nombre: string,
  categoria?: string,
  slugCategoria?: string,
): boolean {
  const parentesisValido = slugCategoria
    ? SLUGS_PARENTESIS_VALIDO.has(slugCategoria)
    : false;
  // Check inicial: nombre y transcripción sin espacios. Cubre casos como
  // "Ajo blanco" (transcripción) vs "ajoblanco" (nombre) — y a la inversa.
  // Quitamos paréntesis del nombre antes de unir, para no incluir la peli/contexto.
  const nLimpio = nombre.replace(/\s*\([^)]+\)\s*$/, "").trim();
  const nSinEsp = normalizar(nLimpio).replace(/\s+/g, "");
  const tSinEsp = normalizar(transcripcion).replace(/\s+/g, "");
  if (nSinEsp.length >= 4 && tSinEsp.includes(nSinEsp)) return true;
  if (tSinEsp.length >= 4 && nSinEsp.includes(tSinEsp)) return true;

  const t = ` ${normalizar(transcripcion)} `;
  const palabras = normalizar(nombre)
    .split(/\s+/)
    .filter((p) => p.length > 2 && !STOP.has(p));
  if (palabras.length === 0) return false;

  const tWords = normalizar(transcripcion).split(/\s+/).filter((w) => w.length >= 3);
  // Versiones fonéticas (castellanas) de las palabras de la transcripción,
  // para emparejar con nombres ingleses pronunciados regular.
  const tWordsFon = tWords.map((w) => fonetizar(w));
  const coincide = (p: string): boolean => {
    // Match directo de palabra completa
    if (t.includes(` ${p} `)) return true;
    // Levenshtein progresivo: tolerancia 1 (5-6 chars), 2 (7+ chars)
    const lim = p.length >= 7 ? 2 : p.length >= 5 ? 1 : 0;
    if (lim > 0 && tWords.some((w) => levenshtein(p, w, lim) <= lim)) return true;
    // Fonética: comparar la forma fonetizada del nombre con la transcripción
    // (cubre "star wars" pronunciado "estar uars", "manchester" como "mánchester", etc.)
    const pFon = fonetizar(p);
    if (pFon !== p && pFon.length >= 3) {
      if (t.includes(` ${pFon} `)) return true;
      if (lim > 0 && tWords.some((w) => levenshtein(pFon, w, lim) <= lim)) return true;
    }
    // Y a la inversa: fonetizar la transcripción
    if (lim > 0 && tWordsFon.some((w) => w !== p && levenshtein(p, w, lim) <= lim)) return true;
    return false;
  };

  if (palabras.length === 1) return coincide(palabras[0]);

  // Palabras genéricas que nunca identifican un item concreto:
  // base fija + palabras de la categoría + palabras entre paréntesis del nombre
  // (lo que va entre paréntesis es la película/contexto, no el nombre del personaje)
  const genericos = new Set(["pez", "flor", "flores"]);
  if (categoria) {
    normalizar(categoria)
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .flatMap(formasCategoria)
      .forEach((w) => genericos.add(w));
  }
  // Añadir palabras dentro de paréntesis como genéricas (película/universo, no el personaje)
  // SALVO en subcategorías donde el paréntesis es el autor (cuadros, esculturas), que
  // sí es respuesta válida.
  if (!parentesisValido) {
    const parentesisMatch = nombre.match(/\(([^)]+)\)/g);
    if (parentesisMatch) {
      for (const m of parentesisMatch) {
        normalizar(m.replace(/[()]/g, ""))
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP.has(w))
          .forEach((w) => genericos.add(w));
      }
    }
  }

  const aciertos = palabras.map((p, i) => ({ i, ok: coincide(p) })).filter((x) => x.ok);
  if (aciertos.length === 0) return false;
  if (aciertos.length >= 2) return true;
  return !genericos.has(palabras[aciertos[0].i]);
}

interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export interface ReconocedorVoz {
  iniciar: () => void;
  parar: () => void;
  resetOffset: () => void;
}

export function crearReconocedor(opts: {
  onTranscripcion: (texto: string) => void;
  onError?: (mensaje: string) => void;
  lang?: string;
}): ReconocedorVoz | null {
  if (!navegadorSoportaVoz()) return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recog = new Ctor();
  recog.lang = opts.lang ?? "es-ES";
  recog.continuous = true;
  recog.interimResults = true;
  let activo = false;
  let reiniciar = false;
  let resultOffset = 0;
  let latestLength = 0;

  recog.onresult = (ev) => {
    latestLength = ev.results.length;
    let texto = "";
    for (let i = resultOffset; i < ev.results.length; i++) {
      texto += (ev.results[i][0]?.transcript ?? "") + " ";
    }
    const txt = texto.trim();
    if (txt) opts.onTranscripcion(txt);
  };
  recog.onerror = (ev) => {
    const err = ev.error ?? "error";
    // "no-speech" es normal; el resto los propagamos
    if (err !== "no-speech" && opts.onError) opts.onError(err);
    // Reiniciar tras error recuperable
    if (activo && reiniciar && (err === "no-speech" || err === "audio-capture")) {
      setTimeout(() => { if (activo && reiniciar) try { recog.lang = opts.lang ?? "es-ES"; recog.start(); } catch {} }, 200);
    }
  };
  recog.onend = () => {
    if (activo && reiniciar) {
      setTimeout(() => { if (activo && reiniciar) try { recog.lang = opts.lang ?? "es-ES"; recog.start(); } catch {} }, 150);
    }
  };

  return {
    iniciar: () => {
      activo = true;
      reiniciar = true;
      try {
        recog.start();
      } catch {
        // ya activo
      }
    },
    parar: () => {
      activo = false;
      reiniciar = false;
      try {
        recog.stop();
      } catch {}
    },
    resetOffset: () => { resultOffset = latestLength; },
  };
}
