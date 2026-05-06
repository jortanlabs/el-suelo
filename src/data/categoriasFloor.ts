import type { ItemFloor } from "../lib/wikidata.ts";
import { palabraClaveDe } from "../lib/wikidata.ts";

export interface CategoriaFloor {
  slug: string;
  nombre: string;
  emoji: string;
  /** Lista de nombres famosos; el servidor los resuelve vía API de Wikidata. */
  nombres?: string[];
  /** Items pre-cargados que no necesitan Wikidata (banderas, etc.). */
  itemsHardcoded?: ItemFloor[];
  /** QIDs de Wikidata que P106 (ocupación) debe incluir para que el item pase el filtro. */
  ocupacionesWikidata?: string[];
  /** QIDs de Wikidata que P31 (instancia de) debe incluir para que el item pase el filtro. */
  instanciasWikidata?: string[];
  /** Palabras clave en la descripción de Wikidata para preferir el match correcto al buscar. */
  descripcionWikidata?: string[];
}

const BANDERAS: Array<{ pais: string; codigo: string }> = [
  { pais: "España", codigo: "es" },
  { pais: "Francia", codigo: "fr" },
  { pais: "Alemania", codigo: "de" },
  { pais: "Italia", codigo: "it" },
  { pais: "Portugal", codigo: "pt" },
  { pais: "Reino Unido", codigo: "gb" },
  { pais: "Estados Unidos", codigo: "us" },
  { pais: "Canadá", codigo: "ca" },
  { pais: "México", codigo: "mx" },
  { pais: "Brasil", codigo: "br" },
  { pais: "Argentina", codigo: "ar" },
  { pais: "Chile", codigo: "cl" },
  { pais: "Colombia", codigo: "co" },
  { pais: "Perú", codigo: "pe" },
  { pais: "Japón", codigo: "jp" },
  { pais: "China", codigo: "cn" },
  { pais: "Corea del Sur", codigo: "kr" },
  { pais: "India", codigo: "in" },
  { pais: "Australia", codigo: "au" },
  { pais: "Rusia", codigo: "ru" },
  { pais: "Ucrania", codigo: "ua" },
  { pais: "Polonia", codigo: "pl" },
  { pais: "Países Bajos", codigo: "nl" },
  { pais: "Bélgica", codigo: "be" },
  { pais: "Grecia", codigo: "gr" },
  { pais: "Turquía", codigo: "tr" },
  { pais: "Egipto", codigo: "eg" },
  { pais: "Marruecos", codigo: "ma" },
  { pais: "Sudáfrica", codigo: "za" },
  { pais: "Suecia", codigo: "se" },
  { pais: "Noruega", codigo: "no" },
  { pais: "Dinamarca", codigo: "dk" },
  { pais: "Finlandia", codigo: "fi" },
  { pais: "Irlanda", codigo: "ie" },
  { pais: "Suiza", codigo: "ch" },
  { pais: "Austria", codigo: "at" },
];

export const categoriasFloor: CategoriaFloor[] = [
  {
    slug: "actores",
    nombre: "Actores y actrices",
    emoji: "🎬",
    // Q33999 actor · Q10800557 film actor · Q2526255 film director · Q3282637 film producer
    ocupacionesWikidata: ["Q33999", "Q10800557", "Q2526255", "Q3282637"],
    nombres: [
      "Tom Hanks", "Meryl Streep", "Leonardo DiCaprio", "Cate Blanchett",
      "Brad Pitt", "Angelina Jolie", "Denzel Washington", "Penélope Cruz",
      "Javier Bardem", "Nicole Kidman", "Joaquin Phoenix", "Natalie Portman",
      "Morgan Freeman", "Julia Roberts", "Robert De Niro", "Al Pacino",
      "Charlize Theron", "Will Smith", "Johnny Depp", "Scarlett Johansson",
      "Emma Stone", "Ryan Gosling", "Jennifer Lawrence", "Anne Hathaway",
      "Halle Berry", "Kate Winslet", "Anthony Hopkins", "Daniel Craig",
      "Matt Damon", "Clint Eastwood", "Tom Cruise", "Keanu Reeves",
      "Audrey Hepburn", "Marilyn Monroe", "Jack Nicholson", "Dustin Hoffman",
      "Sophia Loren", "Antonio Banderas",
      "Harrison Ford", "Samuel L. Jackson", "Hugh Jackman", "James Dean",
      "Marlon Brando", "Grace Kelly", "Chadwick Boseman", "Idris Elba",
      "Christoph Waltz", "Timothée Chalamet", "Cillian Murphy", "Florence Pugh",
      "Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Judi Dench",
      "Ralph Fiennes", "Tilda Swinton", "Gael García Bernal", "Ana de Armas",
    ],
  },
  {
    slug: "cantantes",
    nombre: "Cantantes",
    emoji: "🎤",
    // Q177220 singer · Q36834 composer · Q753110 songwriter · Q488111 recording artist
    ocupacionesWikidata: ["Q177220", "Q36834", "Q753110", "Q488111"],
    nombres: [
      "Michael Jackson", "Madonna", "Freddie Mercury", "Beyoncé",
      "Adele", "Lady Gaga", "Shakira", "Elvis Presley",
      "David Bowie", "Taylor Swift", "Rihanna", "Eminem",
      "Whitney Houston", "Elton John", "Bob Marley", "Frank Sinatra",
      "Amy Winehouse", "Britney Spears", "Justin Bieber", "Ariana Grande",
      "Bruce Springsteen", "Mariah Carey", "Céline Dion", "Enrique Iglesias",
      "Jennifer Lopez", "Bad Bunny", "Rosalía", "Alejandro Sanz",
      "Carlos Santana", "Tina Turner", "Mick Jagger", "Bono",
      "Kurt Cobain", "Prince", "Billie Eilish", "Ed Sheeran",
      "Bruno Mars", "Katy Perry", "Dua Lipa", "The Weeknd",
      "Harry Styles", "Drake", "Kanye West", "Bob Dylan",
      "Paul McCartney", "John Lennon", "Robbie Williams", "Lionel Richie",
      "Sam Smith", "Doja Cat", "Selena Gomez", "Miley Cyrus",
      "Nicki Minaj", "Post Malone", "Demi Lovato", "Lewis Capaldi",
    ],
  },
  {
    slug: "futbolistas",
    nombre: "Futbolistas",
    emoji: "⚽",
    // Q937857 association football player · Q11338576 football manager
    ocupacionesWikidata: ["Q937857", "Q11338576"],
    nombres: [
      "Lionel Messi", "Cristiano Ronaldo", "Pelé", "Diego Maradona",
      "Neymar", "Kylian Mbappé", "Ronaldinho", "Zinedine Zidane",
      "Ronaldo Nazário", "David Beckham", "Andrés Iniesta", "Xavi Hernández",
      "Thierry Henry", "Roberto Carlos", "Cafu", "Gianluigi Buffon",
      "Luka Modrić", "Karim Benzema", "Erling Haaland", "Harry Kane",
      "Mohamed Salah", "Kevin De Bruyne", "Virgil van Dijk", "Sergio Ramos",
      "Zlatan Ibrahimović", "Wayne Rooney", "Fernando Torres", "Raúl González",
      "Roberto Baggio", "Ronaldo",
      "Gareth Bale", "Antoine Griezmann", "Sadio Mané", "Vinicius Jr.",
      "Pedri", "Alexia Putellas", "Iker Casillas", "Xabi Alonso",
      "David Villa", "Cesc Fàbregas", "Paolo Maldini", "Johan Cruyff",
      "Rivaldo", "Didier Drogba", "Clarence Seedorf", "Patrick Vieira",
      "Oliver Kahn", "Peter Schmeichel", "Romário", "Franz Beckenbauer",
    ],
  },
  {
    slug: "monumentos",
    nombre: "Monumentos del mundo",
    emoji: "🏛️",
    descripcionWikidata: ["monument", "monumento", "building", "tower", "cathedral", "temple", "palace", "bridge", "structure", "landmark", "edificio"],
    nombres: [
      "Torre Eiffel", "Coliseo Romano", "Gran Muralla China", "Taj Mahal",
      "Estatua de la Libertad", "Machu Picchu", "Sagrada Familia", "Alhambra",
      "Stonehenge", "Pirámides de Giza", "Partenón", "Big Ben",
      "Torre inclinada de Pisa", "Cristo Redentor", "Angkor Wat",
      "Basílica de San Pedro", "Palacio de Versalles", "Catedral de Notre Dame",
      "Hagia Sofía", "Empire State Building", "Burj Khalifa",
      "Ópera de Sídney", "Arco del Triunfo", "Tower Bridge",
      "Castillo de Neuschwanstein", "Chichén Itzá", "Petra",
      "Monte Rushmore", "Alcázar de Segovia", "Mezquita de Córdoba",
      "Catedral de Colonia", "Castillo de Windsor", "Fuente de Trevi",
      "Panteón de Roma", "Kremlin de Moscú", "Palacio de Buckingham",
      "Pompeya", "Abu Simbel", "Castillo de Edimburgo",
      "Templo de Zeus Olímpico", "Acueducto de Segovia",
    ],
  },
  {
    slug: "banderas",
    nombre: "Banderas de países",
    emoji: "🏳️",
    itemsHardcoded: BANDERAS.map((b) => ({
      nombre: b.pais,
      imagen: `https://flagcdn.com/w320/${b.codigo}.png`,
      palabraClave: palabraClaveDe(b.pais),
    })),
  },
  {
    slug: "mamiferos",
    nombre: "Mamíferos",
    emoji: "🐅",
    // Q16521 = taxon — garantiza que el match es una especie biológica, no una ciudad o marca
    instanciasWikidata: ["Q16521"],
    descripcionWikidata: ["especie", "species", "mammal", "mamifero", "animal"],
    nombres: [
      "Elefante africano", "León africano", "Tigre", "Gorila",
      "Delfín mular", "Oso polar", "Jirafa", "Rinoceronte blanco",
      "Chimpancé", "Leopardo", "Cebra", "Hipopótamo",
      "Lobo gris", "Koala", "Panda gigante", "Ballena azul",
      "Orangután", "Jaguar", "Guepardo", "Oso pardo",
      "Camello", "Llama", "Morsa", "Nutria marina",
      "Bisonte americano", "Alce", "Hiena manchada", "Puma",
      "Foca gris", "Jabalí",
      "Orca", "Manatí", "Tapir", "Okapi",
      "Lémur de cola anillada", "Suricata", "Mandril", "Gibón",
      "Ñu", "Búfalo africano", "Rinoceronte negro", "Lince ibérico",
      "Canguro rojo", "Elefante asiático", "Leopardo de las nieves",
      "Zorro ártico", "Mapache", "Wombat",
    ],
  },
  {
    slug: "historicos",
    nombre: "Personajes históricos",
    emoji: "📜",
    // Q5 = human — descarta ciudades/conceptos con el mismo nombre (ej. "Buda" → ciudad vs persona)
    instanciasWikidata: ["Q5"],
    descripcionWikidata: ["emperor", "general", "philosopher", "scientist", "king", "queen", "president", "leader", "inventor", "painter", "writer", "politician", "militar", "político", "filósofo", "científico"],
    nombres: [
      "Napoleón Bonaparte", "Julio César", "Alejandro Magno", "Cleopatra",
      "Leonardo da Vinci", "Galileo Galilei", "Isaac Newton", "Marie Curie",
      "Abraham Lincoln", "Winston Churchill", "Albert Einstein", "Cristóbal Colón",
      "Hernán Cortés", "Mahoma", "Buda", "Aristóteles",
      "Platón", "Sócrates", "Juana de Arco", "Simón Bolívar",
      "Che Guevara", "Thomas Jefferson", "Benjamin Franklin",
      "Catalina la Grande", "Otto von Bismarck", "Giuseppe Garibaldi",
      "Miguel Ángel", "Rafael Sanzio", "Gengis Kan", "Marco Polo",
      "Martin Luther King", "Nelson Mandela", "Mahatma Gandhi",
      "Nikola Tesla", "Thomas Edison", "Sigmund Freud",
      "Karl Marx", "Mao Zedong", "Joseph Stalin",
      "Charles de Gaulle", "Francisco Franco", "Tutankamón",
      "Charles Darwin", "Voltaire", "Ramses II",
    ],
  },
  {
    slug: "ciudades",
    nombre: "Ciudades del mundo",
    emoji: "🏙️",
    descripcionWikidata: ["city", "ciudad", "capital", "town", "municipality", "municipio", "prefecture"],
    nombres: [
      "Tokio", "París", "Nueva York", "Londres",
      "Pekín", "Sídney", "Roma", "Barcelona",
      "Buenos Aires", "Río de Janeiro", "Moscú", "Mumbai",
      "Estambul", "El Cairo", "Ciudad de México", "Ámsterdam",
      "Berlín", "Madrid", "Dubái", "Chicago",
      "Los Ángeles", "Toronto", "Seúl", "Bangkok",
      "Singapur", "São Paulo", "Lima", "Bogotá",
      "Santiago de Chile", "Johannesburgo", "Viena", "Praga",
      "Budapest", "Lisboa", "Nairobi",
      "Shanghái", "Hong Kong", "Osaka", "La Habana",
      "Estocolmo", "Oslo", "Helsinki", "Varsovia",
      "Atenas", "Milán", "Bruselas", "Dublín",
      "Auckland", "Kuala Lumpur", "Yakarta", "Taipéi",
      "Lagos", "Casablanca",
    ],
  },
];

export function categoriaFloorBySlug(slug: string): CategoriaFloor | undefined {
  return categoriasFloor.find((c) => c.slug === slug);
}
