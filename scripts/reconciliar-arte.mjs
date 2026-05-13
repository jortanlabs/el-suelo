// scripts/reconciliar-arte.mjs
// Reescribe arte-cuadros.json y arte-esculturas.json con la nueva lista canónica
// (nombre + autor en paréntesis), conservando las imágenes ya subidas mediante
// un mapping de "nombre viejo" → "nombre nuevo".

import { readFileSync, writeFileSync } from "node:fs";

function reconciliar(path, canonicos, mapping) {
  const viejos = JSON.parse(readFileSync(path, "utf8"));
  // mapaImg: nombre viejo (con/sin alias) → imagen
  const mapaImg = new Map();
  for (const it of viejos) {
    if (!mapaImg.has(it.nombre)) mapaImg.set(it.nombre, it.imagen || "");
  }
  const result = canonicos.map((canon) => {
    const candidatos = [canon, ...(mapping[canon] ?? [])];
    let imagen = "";
    for (const c of candidatos) {
      const img = mapaImg.get(c);
      if (img) { imagen = img; break; }
    }
    return { nombre: canon, imagen };
  });
  writeFileSync(path, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log(`\n${path}: ${viejos.length} → ${result.length}`);
  for (const r of result) {
    console.log(`  ${r.imagen ? "✓" : " "} ${r.nombre}${r.imagen ? "" : "  (sin imagen)"}`);
  }
}

// ── Cuadros ──────────────────────────────────────────────────────
const cuadrosCanon = [
  "La Mona Lisa (Leonardo da Vinci)",
  "La última cena (Leonardo da Vinci)",
  "La noche estrellada (Van Gogh)",
  "Las Meninas (Velázquez)",
  "El jardín de las delicias (El Bosco)",
  "El Guernica (Picasso)",
  "Los girasoles (Van Gogh)",
  "La joven de la perla (Vermeer)",
  "El grito (Munch)",
  "La libertad guiando al pueblo (Delacroix)",
  "Saturno devorando a su hijo (Goya)",
  "La maja desnuda (Goya)",
  "El nacimiento de Venus (Botticelli)",
  "El beso (Klimt)",
  "La creación de Adán (Miguel Ángel)",
  "La escuela de Atenas (Rafael)",
  "Los fusilamientos del 3 de mayo (Goya)",
  "La persistencia de la memoria (Dalí)",
  "Las señoritas de Aviñón (Picasso)",
  "La balsa de la Medusa (Géricault)",
  "El juicio final (Miguel Ángel)",
  "Las dos Fridas (Frida Kahlo)",
];

const cuadrosMapping = {
  "La Mona Lisa (Leonardo da Vinci)": ["La Mona Lisa", "Mona Lisa", "Mona Lisa a los 12 años"],
  "La última cena (Leonardo da Vinci)": ["La última cena"],
  "La noche estrellada (Van Gogh)": ["La noche estrellada"],
  "Las Meninas (Velázquez)": ["Las Meninas"],
  "El jardín de las delicias (El Bosco)": ["El jardín de las delicias"],
  "El Guernica (Picasso)": ["El Guernica"],
  "Los girasoles (Van Gogh)": ["Los girasoles"],
  "La joven de la perla (Vermeer)": ["La joven de la perla"],
  "El grito (Munch)": ["El grito"],
  "La libertad guiando al pueblo (Delacroix)": ["La libertad guiando al pueblo"],
  "Saturno devorando a su hijo (Goya)": ["Saturno devorando a su hijo"],
  "La maja desnuda (Goya)": ["La maja desnuda"],
  "El nacimiento de Venus (Botticelli)": ["El nacimiento de Venus"],
  "El beso (Klimt)": ["El beso"],
  "La creación de Adán (Miguel Ángel)": ["La creación de Adán"],
  "La escuela de Atenas (Rafael)": ["La escuela de Atenas"],
  "Los fusilamientos del 3 de mayo (Goya)": ["Los fusilamientos del 3 de mayo"],
  "La persistencia de la memoria (Dalí)": ["La persistencia de la memoria"],
  "Las señoritas de Aviñón (Picasso)": ["Las señoritas de Aviñón"],
  "La balsa de la Medusa (Géricault)": ["La balsa de la Medusa"],
  "El juicio final (Miguel Ángel)": ["El juicio final"],
  "Las dos Fridas (Frida Kahlo)": ["Las dos Fridas"],
};

// ── Esculturas ──────────────────────────────────────────────────
const esculturasCanon = [
  "La Venus de Milo",
  "El pensador (Rodin)",
  "El David (Miguel Ángel)",
  "La Piedad (Miguel Ángel)",
  "El discóbolo (Mirón)",
  "Nike de Samotracia",
  "El beso (Rodin)",
  "El beso (Brancusi)",
  "Laocoonte",
  "La Estatua de la Libertad (Bartholdi)",
  "Busto de Nefertiti",
  "La Sirenita (Eriksen)",
  "El Ángel Caído (Bellver)",
  "El Cristo Redentor (Landowski)",
  "El toro de Wall Street (Di Modica)",
  "Los burgueses de Calais (Rodin)",
  "Moais de la Isla de Pascua",
  "La Esfinge de Giza",
  "Cloud Gate (Kapoor)",
  "Éxtasis de Santa Teresa (Bernini)",
  "Apolo y Dafne (Bernini)",
  "Maman (Bourgeois)",
  "Manneken Pis (Duquesnoy)",
  "Monte Rushmore (Borglum)",
  "Moisés (Miguel Ángel)",
];

const esculturasMapping = {
  "La Venus de Milo": ["La Venus de Milo", "Venus de Milo"],
  "El pensador (Rodin)": ["El pensador"],
  "El David (Miguel Ángel)": ["El David", "David (Miguel Ángel)"],
  "La Piedad (Miguel Ángel)": ["La Piedad", "La Pietà"],
  "El discóbolo (Mirón)": ["El discóbolo", "Discóbolo", "Discóbolo de Mirón"],
  "Nike de Samotracia": ["Nike de Samotracia"],
  "El beso (Rodin)": ["El Beso de Rodin"],
  "El beso (Brancusi)": ["El beso (Brancusi)", "El beso"],
  "Laocoonte": ["Laocoonte"],
  "La Estatua de la Libertad (Bartholdi)": ["La Libertad", "Estatua de la Libertad"],
  "Busto de Nefertiti": ["Busto de Nefertiti"],
  "La Sirenita (Eriksen)": ["La sirenita", "Sirenita de Copenhague"],
  "El Ángel Caído (Bellver)": ["El Ángel Caído"],
  "El Cristo Redentor (Landowski)": ["El Cristo Redentor", "Cristo Redentor"],
  "El toro de Wall Street (Di Modica)": ["El toro de Wall Street", "Toro de Wall Street"],
  "Los burgueses de Calais (Rodin)": ["Los burgueses de Calais"],
  "Moais de la Isla de Pascua": ["Moais", "Moais de la Isla de Pascua"],
  "La Esfinge de Giza": ["Gran Esfinge de Giza", "Esfinge de Guiza"],
  "Cloud Gate (Kapoor)": ["Cloud gate"],
  "Éxtasis de Santa Teresa (Bernini)": ["Éxtasis de Santa Teresa"],
  "Apolo y Dafne (Bernini)": ["Apolo y Dafne"],
  "Maman (Bourgeois)": ["Maman"],
  "Manneken Pis (Duquesnoy)": ["Mannenken pis", "Manneken Pis"],
  "Monte Rushmore (Borglum)": ["Monte Rushmore", "Mount Rushmore"],
  "Moisés (Miguel Ángel)": ["Moisés de Miguel Ángel"],
};

reconciliar("public/data/mundo/arte-cuadros.json", cuadrosCanon, cuadrosMapping);
reconciliar("public/data/mundo/arte-esculturas.json", esculturasCanon, esculturasMapping);
