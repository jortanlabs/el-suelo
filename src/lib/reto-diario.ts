// src/lib/reto-diario.ts
// Lógica determinística para el reto diario:
// - misma categoría para todos los jugadores del día (hash de la fecha sobre el pool)
// - mismos items en mismo orden (hash de fecha+slug → shuffle determinístico)
// - tope de 20 items por reto (limita el "gasto" de categorías grandes)

import type { ItemFloor } from "./floor-client.ts";

export const TIEMPO_RETO_S = 30;
export const MAX_ITEMS_RETO = 20;
export const PENALIZACION_PASE_S = 3;

// "YYYY-MM-DD" anclado a Europe/Madrid (medianoche peninsular = nuevo reto).
export function diaHoy(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

// Hash entero determinístico de un string (estilo java String.hashCode).
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function categoriaRetoHoy(pool: string[], fechaISO?: string): string | null {
  if (pool.length === 0) return null;
  const f = fechaISO ?? diaHoy();
  return pool[hash("cat:" + f) % pool.length];
}

// Fisher-Yates con LCG semillado por fecha+slug. Reproducible para todos.
export function subsetReto(
  items: ItemFloor[],
  slug: string,
  fechaISO?: string,
  max = MAX_ITEMS_RETO,
): ItemFloor[] {
  const f = fechaISO ?? diaHoy();
  let s = hash(f + ":" + slug) || 1;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(max, arr.length));
}

// ── Persistencia local ───────────────────────────────────────────
const HOY_KEY = (f: string) => `el-suelo:reto:${f}`;
const HIST_KEY = "el-suelo:reto-historial:v1";

export interface ResultadoReto {
  fecha: string;          // YYYY-MM-DD
  slug: string;
  catNombre: string;
  catEmoji: string;
  aciertos: number;
  tope: number;           // tamaño del subset jugado (≤ MAX_ITEMS_RETO)
}

export function leerResultadoHoy(): ResultadoReto | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(HOY_KEY(diaHoy()));
    return raw ? (JSON.parse(raw) as ResultadoReto) : null;
  } catch { return null; }
}

export function guardarResultado(r: ResultadoReto): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(HOY_KEY(r.fecha), JSON.stringify(r));
    const hist = leerHistorial();
    const sinDuplicado = hist.filter((h) => h.fecha !== r.fecha);
    sinDuplicado.unshift(r);
    localStorage.setItem(HIST_KEY, JSON.stringify(sinDuplicado.slice(0, 10)));
  } catch {}
}

export function leerHistorial(): ResultadoReto[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIST_KEY);
    return raw ? (JSON.parse(raw) as ResultadoReto[]) : [];
  } catch { return []; }
}

// Texto formateado para compartir por WhatsApp / Twitter / etc.
export function textoCompartir(r: ResultadoReto, dominio: string): string {
  const [, m, d] = r.fecha.split("-");
  const mes = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][Number(m) - 1];
  return `🎯 El Suelo · ${Number(d)} ${mes}\n${r.catEmoji} ${r.catNombre}\n✅ ${r.aciertos}/${r.tope} aciertos en ${TIEMPO_RETO_S}s\n${dominio}`;
}
