/**
 * Catálogo de Cine y Series — jerarquía de bloques y subcategorías.
 * Los items reales se cargan dinámicamente desde /public/data/cine/{slug}.json
 */
import {
  bloques,
  subcategorias,
  type BloqueInfo,
  type SubcategoriaNombres,
} from "./cine/nombres.ts";

export type { BloqueInfo, SubcategoriaNombres };
export { bloques, subcategorias };

/** Subcategorías jugables (con nombres propios, no mezclas, no pendientes) */
export function subcatsJugables(): SubcategoriaNombres[] {
  return subcategorias.filter((s) => !s.esMetaCategoria && !!s.nombres && !s.pendiente);
}

/** Subcategorías de un bloque concreto (incluye mezcla) */
export function subcatsPorBloque(slugBloque: string): SubcategoriaNombres[] {
  return subcategorias.filter((s) => s.bloque === slugBloque);
}

/** Todas las subcategorías jugables de un bloque */
export function subcatsJugablesPorBloque(slugBloque: string): SubcategoriaNombres[] {
  return subcategorias.filter(
    (s) => s.bloque === slugBloque && !s.esMetaCategoria && !!s.nombres && !s.pendiente,
  );
}

/** Resuelve los slugs de una mezcla expandiendo recursivamente */
export function slugsDeMetaCategoria(slug: string): string[] {
  const meta = subcategorias.find((s) => s.slug === slug);
  if (!meta?.esMetaCategoria || !meta.subcategorias) return [slug];
  return meta.subcategorias.flatMap((s) => slugsDeMetaCategoria(s));
}
