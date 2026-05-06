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
    if (parsed.expira > Date.now()) return parsed.data;
    localStorage.removeItem(k);
  } catch {}
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

  if (apiEspecializada === "deezer") {
    items = await resolverConDeezer(nombres);
    if (items.length < 8) {
      // Complementar con Wikidata para los que Deezer no encontró
      const encontrados = new Set(items.map((i) => i.nombre));
      const faltantes = nombres.filter((n) => !encontrados.has(n));
      const extra = await resolverNombres(faltantes, 5, ocupaciones, instancias, descripcion);
      items = [...items, ...extra];
    }
  } else {
    items = await resolverNombres(nombres, 5, ocupaciones, instancias, descripcion);
  }

  if (items.length < 8) throw new Error(`Solo se encontraron ${items.length} imágenes. Recarga para intentarlo de nuevo.`);
  guardarCache(k, items);
  return items;
}

type WpPagesResp = {
  query?: { pages?: Record<string, { title?: string; missing?: string; thumbnail?: { source?: string } }> };
};

type WpRestSummary = {
  type?: string;
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
): Promise<ItemFloor[]> {
  const result: ItemFloor[] = [];
  for (let i = 0; i < nombres.length; i += paralelos) {
    const lote = nombres.slice(i, i + paralelos);
    const resueltos = await Promise.all(
      lote.map(async (nombre): Promise<ItemFloor | null> => {
        // Nombre de display: quita sufijo de desambiguación "Elsa (Frozen)" → "Elsa"
        const nombreDisplay = nombre.replace(/\s*\([^)]+\)\s*$/, "").trim() || nombre;
        const slug = nombre.replace(/ /g, "_");

        // Fase 1: REST summary directo — más fiable cuando el nombre = título Wikipedia
        for (const lang of ["en", "es"]) {
          try {
            const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
            const res = await fetch(url, { headers: { accept: "application/json" } });
            if (!res.ok) continue;
            const data = (await res.json()) as WpRestSummary;
            if (data.type === "disambiguation") continue;
            if (data.thumbnail?.source) {
              return { nombre: nombreDisplay, imagen: data.thumbnail.source, palabraClave: palabraClaveDe(nombreDisplay) };
            }
          } catch {}
        }

        // Fase 2: generator=search — para títulos aproximados o con variación ortográfica
        const normNombre = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
        for (const lang of ["en", "es"]) {
          try {
            const url =
              `https://${lang}.wikipedia.org/w/api.php` +
              `?action=query&generator=search&gsrsearch=${encodeURIComponent(nombre)}` +
              `&gsrlimit=5&prop=pageimages&pithumbsize=400&redirects=1&format=json&origin=*`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = (await res.json()) as WpPagesResp;
            const pages = Object.values(data.query?.pages ?? {})
              .filter((p) => !("missing" in p) && p.thumbnail?.source);
            if (pages.length === 0) continue;
            const ranked = pages.sort((a, b) => {
              const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
              const ta = norm(a.title ?? ""); const tb = norm(b.title ?? "");
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
  const items = await resolverConWikipedia(data.nombres);
  if (items.length < 8) {
    throw new Error(`Solo se encontraron ${items.length} imágenes para esta categoría. Prueba con una categoría más específica o famosa.`);
  }
  guardarCache(k, items);
  return items;
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

function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 999;
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

export function aciertoFlexible(
  transcripcion: string,
  nombre: string,
  categoria?: string,
): boolean {
  const t = ` ${normalizar(transcripcion)} `;
  const palabras = normalizar(nombre)
    .split(/\s+/)
    .filter((p) => p.length > 2 && !STOP.has(p));
  if (palabras.length === 0) return false;

  const tWords = normalizar(transcripcion).split(/\s+/).filter((w) => w.length >= 4);
  const coincide = (p: string): boolean => {
    if (t.includes(` ${p} `)) return true;
    return p.length >= 5 && tWords.some((w) => levenshtein(p, w) <= 1);
  };

  if (palabras.length === 1) return coincide(palabras[0]);

  // Palabras genéricas que nunca identifican un item concreto:
  // base fija + todas las palabras significativas de la categoría activa (con sus formas)
  const genericos = new Set(["pez", "flor", "flores"]);
  if (categoria) {
    normalizar(categoria)
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w))
      .flatMap(formasCategoria)
      .forEach((w) => genericos.add(w));
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
