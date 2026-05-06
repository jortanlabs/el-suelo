export interface ItemFloor {
  /** Nombre completo (display) del item, ej. "Andrés Iniesta". */
  nombre: string;
  /** URL de imagen (Wikimedia Commons, ya con tamaño 400px). */
  imagen: string;
  /** Palabra-clave que el speech-to-text debe contener para aceptar la respuesta. */
  palabraClave: string;
}

const COMMONS_REDIRECT = "https://commons.wikimedia.org/wiki/Special:Redirect/file";

function commonsImageUrl(filename: string, width = 600): string {
  return `${COMMONS_REDIRECT}/${encodeURIComponent(filename)}?width=${width}`;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

export function palabraClaveDe(nombre: string): string {
  const limpio = normalizar(nombre);
  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return limpio;
  if (palabras.length === 1) return palabras[0];
  const stopWords = new Set([
    "de", "del", "la", "el", "los", "las",
    "y", "i", "of", "the", "a", "an", "le", "la", "les",
  ]);
  for (let i = palabras.length - 1; i >= 0; i--) {
    if (!stopWords.has(palabras[i])) return palabras[i];
  }
  return palabras[palabras.length - 1];
}

interface SearchEntity {
  id: string;
  label?: string;
  description?: string;
}

/**
 * Busca una entidad por nombre en Wikidata. Prefiere el resultado con label exacto.
 * Si se pasan palabras clave de descripción, se usa como desempate para elegir
 * el resultado cuya descripción mejor encaja con la categoría esperada
 * (ej. "Puma" → preferir la especie sobre la marca deportiva).
 */
async function buscarEntidad(termino: string, descripcionPreferida?: string[]): Promise<SearchEntity | null> {
  const norm = normalizar(termino);

  for (const lang of ["es", "en"]) {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(termino)}&language=${lang}&type=item&limit=5&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as { search?: SearchEntity[] };
      const results = data.search ?? [];
      if (results.length === 0) continue;
      const exactMatch = results.find((r) => normalizar(r.label ?? "") === norm);
      if (exactMatch) return exactMatch;
      if (descripcionPreferida?.length) {
        const kws = descripcionPreferida.map(normalizar);
        const descMatch = results.find((r) => {
          const desc = normalizar(r.description ?? "");
          return kws.some((k) => desc.includes(k));
        });
        if (descMatch) return descMatch;
      }
      // Solo devuelve el primero si fue la búsqueda en español (más fiable para nombres en ES)
      if (lang === "es") return results[0];
    } catch {}
  }
  return null;
}

export async function resolverNombres(
  nombres: string[],
  paralelos = 10,
  ocupacionesPermitidas?: string[],
  instanciasPermitidas?: string[],
  descripcionPreferida?: string[],
  preferirLogo = false,
): Promise<ItemFloor[]> {
  // Paso 1: IDs en paralelo; pasa descripcionPreferida para desambiguar en búsqueda
  const encontradas: Array<{ id: string; label: string }> = [];
  for (let i = 0; i < nombres.length; i += paralelos) {
    const lote = nombres.slice(i, i + paralelos);
    const results = await Promise.all(
      lote.map(async (nombre): Promise<{ id: string; label: string } | null> => {
        const ent = await buscarEntidad(nombre, descripcionPreferida);
        if (!ent) return null;
        return { id: ent.id, label: nombre };
      }),
    );
    for (const r of results) if (r) encontradas.push(r);
  }
  if (encontradas.length === 0) return [];

  // Paso 2: batch de imágenes P18 (máx 50 IDs por lote)
  const resolved: ItemFloor[] = [];
  for (let i = 0; i < encontradas.length; i += 50) {
    const lote = encontradas.slice(i, i + 50);
    const ids = lote.map((e) => e.id).join("|");
    try {
      const res = await fetch("https://www.wikidata.org/w/api.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `action=wbgetentities&ids=${encodeURIComponent(ids)}&props=claims%7Clabels&languages=es%7Cen&format=json&origin=*`,
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        entities?: Record<string, {
          labels?: Record<string, { value: string }>;
          claims?: {
            P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
            P154?: Array<{ mainsnak?: { datavalue?: { value?: string } } }>;
            P106?: Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>;
            P31?: Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>;
          };
        }>;
      };
      for (const ent of lote) {
        const entity = data.entities?.[ent.id];
        if (!entity) continue;
        // P18 = foto; P154 = logo. preferirLogo invierte el orden para categorías de marcas.
        const p18 = preferirLogo
          ? (entity.claims?.P154?.[0]?.mainsnak?.datavalue?.value ?? entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value)
          : (entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? entity.claims?.P154?.[0]?.mainsnak?.datavalue?.value);
        if (!p18) continue;

        // Filtro por ocupación P106 (personas: actores, cantantes, futbolistas…)
        if (ocupacionesPermitidas && ocupacionesPermitidas.length > 0) {
          const p106 = entity.claims?.P106;
          if (!p106 || p106.length === 0) continue;
          const ocupaciones = p106
            .map((c) => c?.mainsnak?.datavalue?.value?.id)
            .filter((id): id is string => typeof id === "string");
          if (!ocupacionesPermitidas.some((q) => ocupaciones.includes(q))) continue;
        }

        // Filtro por instancia P31 (especies, personas históricas…)
        if (instanciasPermitidas && instanciasPermitidas.length > 0) {
          const p31 = entity.claims?.P31;
          if (!p31 || p31.length === 0) continue;
          const instancias = p31
            .map((c) => c?.mainsnak?.datavalue?.value?.id)
            .filter((id): id is string => typeof id === "string");
          if (!instanciasPermitidas.some((q) => instancias.includes(q))) continue;
        }

        resolved.push({
          nombre: ent.label,
          imagen: commonsImageUrl(p18),
          palabraClave: palabraClaveDe(ent.label),
        });
      }
    } catch {}
  }
  return resolved;
}
