// Dedupe inteligente para temas de cine/series:
// - Si hay "Nombre" y "Nombre (Peli)", se queda la versión CON paréntesis
// - Si solo está "Nombre" sin paréntesis: lo intenta enriquecer con el mapeo manual
// - Si hay duplicados exactos: solo deja uno
// Después aplica un mapeo de renames para añadir paréntesis donde se conoce.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// Devuelve el nombre antes del primer paréntesis: "Hades (Hércules)" → "Hades"
function nombreBase(nombre) {
  const m = nombre.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : nombre.trim();
}
function tienePar(nombre) { return /\([^)]+\)/.test(nombre); }
function clave(nombre) { return norm(nombreBase(nombre)); }

// Mapeo de renames: cuando un nombre suelto aparezca, se reemplaza por la versión con paréntesis.
// Solo aplica si NO hay ya una versión con paréntesis en el array (eso lo decide la lógica más abajo).
const renames = {
  // disney-villanos extras añadidos sin paréntesis
  "El Sombrerero Loco": "El Sombrerero Loco (Alicia en el País de las Maravillas)",
  "Sid Phillips": "Sid Phillips (Toy Story)",
  "Hopper": "Hopper (Bichos)",
  "Stinky Pete": "Stinky Pete (Toy Story 2)",
  "Davy Jones": "Davy Jones (Piratas del Caribe)",
  "Kaa": "Kaa (El Libro de la Selva)",
  "Tai Lung": "Tai Lung (Kung Fu Panda)",
  "Lord Farquaad": "Lord Farquaad (Shrek)",
  "Lobo Feroz": "Lobo Feroz (Los tres cerditos)",
  "John Silver": "John Silver (El Planeta del Tesoro)",
  "Ratigan": "Ratigan (Basil, el ratón superdetective)",
  "Edgar Balthazar": "Edgar Balthazar (Los Aristogatos)",
  "Te Ka": "Te Ka (Vaiana)",
  "Charles Muntz": "Charles Muntz (Up)",
  "Bowler Hat Guy": "Bowler Hat Guy (Descubriendo a los Robinsons)",
  "Yokai": "Yokai (Big Hero 6)",
  "Tamatoa": "Tamatoa (Vaiana)",
  // nickelodeon
  "Bob Esponja": "Bob Esponja (Bob Esponja)",
  "Patricio Estrella": "Patricio Estrella (Bob Esponja)",
  "Calamardo": "Calamardo (Bob Esponja)",
  "Don Cangrejo": "Don Cangrejo (Bob Esponja)",
  "Plankton": "Plankton (Bob Esponja)",
  "Arenita Mejillas": "Arenita Mejillas (Bob Esponja)",
  "Arnold": "Arnold (¡Oye, Arnold!)",
  "Helga Pataki": "Helga Pataki (¡Oye, Arnold!)",
  "Tommy Pickles": "Tommy Pickles (Rugrats)",
  "Angélica Pickles": "Angélica Pickles (Rugrats)",
  "Chuckie Finster": "Chuckie Finster (Rugrats)",
  "Dora la Exploradora": "Dora la Exploradora (Dora)",
  "Botas": "Botas (Dora la Exploradora)",
  "Diego": "Diego (Go, Diego, Go!)",
  "Caillou": "Caillou (Caillou)",
  "Leonardo Tortuga Ninja": "Leonardo (Tortugas Ninja)",
  "Donatello Tortuga Ninja": "Donatello (Tortugas Ninja)",
  "Rafael Tortuga Ninja": "Rafael (Tortugas Ninja)",
  "Michelangelo Tortuga Ninja": "Michelangelo (Tortugas Ninja)",
  "iCarly": "Carly Shay (iCarly)",
  "Sam Puckett": "Sam Puckett (iCarly)",
  "Freddie Benson": "Freddie Benson (iCarly)",
  "Spencer Shay": "Spencer Shay (iCarly)",
  "Drake Parker": "Drake Parker (Drake y Josh)",
  "Josh Nichols": "Josh Nichols (Drake y Josh)",
  "Megan Parker": "Megan Parker (Drake y Josh)",
  "Zoey Brooks": "Zoey Brooks (Zoey 101)",
  "JoJo Siwa": "JoJo Siwa",
  "Kenan Thompson": "Kenan Rockmore (Kenan y Kel)",
  "Kel Mitchell": "Kel Kimble (Kenan y Kel)",
  "Jimmy Neutrón": "Jimmy Neutrón (Jimmy Neutrón)",
  "Sheen Estevez": "Sheen Estevez (Jimmy Neutrón)",
  "Carl Wheezer": "Carl Wheezer (Jimmy Neutrón)",
  "Cindy Vortex": "Cindy Vortex (Jimmy Neutrón)",
  "Aang": "Aang (Avatar: la leyenda de Aang)",
  "Katara": "Katara (Avatar: la leyenda de Aang)",
  "Sokka": "Sokka (Avatar: la leyenda de Aang)",
  "Toph": "Toph (Avatar: la leyenda de Aang)",
  "Zuko": "Zuko (Avatar: la leyenda de Aang)",
  "Korra": "Korra (La leyenda de Korra)",
  "Henry Hart": "Henry Hart (Henry Danger)",
  "Captain Man": "Captain Man (Henry Danger)",
  // indiana-jones, jurassic-park: los nuevos sin paréntesis no son personajes de OTRAS pelis, así que se quedan
};

const dirs = [
  { dir: "public/data/cine", aplicarRenames: true },
  { dir: "public/data/mundo", aplicarRenames: false },
];

for (const { dir, aplicarRenames } of dirs) {
  for (const f of readdirSync(join(ROOT, dir)).filter((x) => x.endsWith(".json"))) {
    const path = join(ROOT, dir, f);
    const data = JSON.parse(readFileSync(path, "utf-8"));

    // Paso 1: aplicar renames sobre items SIN paréntesis (solo si no hay ya una versión con paréntesis)
    if (aplicarRenames) {
      // Pre-índice: claves base que ya tienen una versión con paréntesis en el array
      const tienenParCon = new Set(
        data.filter((it) => tienePar(it.nombre || "")).map((it) => clave(it.nombre || "")),
      );
      for (const it of data) {
        if (tienePar(it.nombre || "")) continue;
        const k = clave(it.nombre || "");
        if (tienenParCon.has(k)) continue; // ya hay otra con paréntesis, este se borrará después
        if (renames[it.nombre]) it.nombre = renames[it.nombre];
      }
    }

    // Paso 2: dedupe por clave base. Si hay duplicado, preferir el que tenga paréntesis y/o imagen.
    const porClave = new Map();
    for (const it of data) {
      const k = clave(it.nombre || "");
      if (!k) continue;
      const existing = porClave.get(k);
      if (!existing) { porClave.set(k, it); continue; }
      // Comparar: el "mejor" gana
      const score = (item) => (item.imagen ? 2 : 0) + (tienePar(item.nombre) ? 1 : 0);
      if (score(it) > score(existing)) porClave.set(k, it);
    }

    const nuevoArray = [...porClave.values()];
    const eliminados = data.length - nuevoArray.length;
    if (eliminados > 0) {
      writeFileSync(path, JSON.stringify(nuevoArray, null, 2));
      console.log(`${f}: -${eliminados} duplicados (era ${data.length}, ahora ${nuevoArray.length})`);
    }
  }
}

console.log("\n✓ Dedupe terminado");
