// Suma items nuevos a cada tema sin tocar las imágenes existentes.
// Deduplicación case-insensitive y normalizando acentos.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

// === Cine ===
const cineLists = {
  "disney-villanos": [
    "Cruella de Vil", "Hades", "Yzma", "Gastón", "El Sombrerero Loco", "Lady Tremaine", "Dr. Facilier",
    "Sid Phillips", "Lotso", "Randall Boggs", "Hopper", "Stinky Pete", "Davy Jones", "Kaa", "Tai Lung",
    "Lord Farquaad", "Lobo Feroz", "Madame Mim", "John Silver", "Ratigan", "Edgar Balthazar",
    "Shere Khan", "Te Ka", "Charles Muntz", "Bowler Hat Guy", "Dawn Bellwether", "Yokai",
    "Príncipe Hans", "Tamatoa", "Frollo",
  ],
  "nickelodeon": [
    "Bob Esponja", "Patricio Estrella", "Calamardo", "Don Cangrejo", "Plankton", "Arenita Mejillas",
    "Arnold", "Helga Pataki", "Tommy Pickles", "Angélica Pickles", "Chuckie Finster", "Dora la Exploradora",
    "Botas", "Diego", "Caillou", "Leonardo Tortuga Ninja", "Donatello Tortuga Ninja",
    "Rafael Tortuga Ninja", "Michelangelo Tortuga Ninja", "iCarly", "Sam Puckett", "Freddie Benson",
    "Spencer Shay", "Drake Parker", "Josh Nichols", "Megan Parker", "Zoey Brooks", "JoJo Siwa",
    "Kenan Thompson", "Kel Mitchell", "Jimmy Neutrón", "Sheen Estevez", "Carl Wheezer", "Cindy Vortex",
    "Aang", "Katara", "Sokka", "Toph", "Zuko", "Korra", "Henry Hart", "Captain Man",
  ],
  "jurassic-park": [
    "T-Rex", "Velociraptor", "Triceratops", "Stegosaurus", "Brachiosaurus", "Spinosaurus",
    "Pteranodon", "Compsognathus", "Gallimimus", "Mosasaurus", "Dilophosaurus", "Indominus Rex",
    "Indoraptor", "Alan Grant", "Ellie Sattler", "Ian Malcolm", "John Hammond", "Dennis Nedry",
    "Robert Muldoon", "Tim Murphy", "Lex Murphy", "Owen Grady", "Claire Dearing", "Maisie Lockwood",
    "Henry Wu", "Sarah Harding", "Roland Tembo", "Charlie", "Blue", "Delta", "Echo",
    "Allosaurus", "Carnotaurus", "Giganotosaurus", "Ankylosaurus",
  ],
  "indiana-jones": [
    "Indiana Jones", "Marion Ravenwood", "Henry Jones Sr.", "Short Round", "Willie Scott",
    "Mola Ram", "Belloq", "Toht", "Sallah", "Marcus Brody", "Elsa Schneider", "Vogel",
    "Mutt Williams", "Irina Spalko", "Helena Shaw", "Voller", "Lao Che",
    "Arca de la Alianza", "Piedras de Sankara", "Santo Grial", "Cruz de Coronado",
    "Calavera de Cristal", "Cetro de Ra", "Templo Maldito", "Castillo de Brunwald", "El Cairo",
    "Cementerio de Tanis", "Cataratas Iguazú", "Látigo de Indy", "Sombrero de Indy",
    "Diario del Grial", "Petra (Tesoro)",
  ],
};

// === Mundo / Geografía / España / Fútbol / Basket / Arte / Marcas / Personas ===
const mundoLists = {
  "es-comunidades": [], // ya tiene las 17 + 2 ciudades autónomas
  "es-gastronomia": [
    "Calçots", "Esqueixada", "Escudella", "Pa amb tomàquet", "Suquet de peix", "Romesco",
    "Fideuá", "Arroz negro", "Arroz a banda", "Salmorejo", "Ajoblanco", "Caracoles a la madrileña",
    "Bocadillo de calamares", "Patatas bravas", "Boquerones en vinagre", "Pescaíto frito",
    "Tortillitas de camarones", "Rabo de toro", "Flamenquín", "Cordero asado", "Lechazo",
    "Pulpo a la gallega", "Mejillones a la marinera", "Almejas a la marinera", "Berberechos",
    "Percebes", "Lacón con grelos", "Pote gallego", "Empanada de bonito", "Migas extremeñas",
    "Caldereta extremeña", "Olla podrida", "Marmitako", "Pintxos", "Bacalao al pil-pil",
    "Bacalao a la vizcaína", "Txuleta", "Cochinillo segoviano", "Yemas de Santa Teresa",
    "Polvorones", "Mantecados", "Roscón de Reyes", "Tarta de Santiago", "Crema catalana",
    "Leche frita", "Natillas", "Arroz con leche", "Filloas", "Pestiños", "Sangría",
    "Tinto de verano", "Horchata", "Vermut", "Sidra", "Cava", "Jerez", "Mojama", "Cecina",
    "Morcón", "Lomo embuchado", "Chistorra", "Butifarra", "Sobrasada", "Queso manchego",
    "Queso de Cabrales", "Queso de Mahón", "Aceitunas", "Boquerones fritos", "Espetos",
  ],
  "geo-monumentos": [
    "Coliseo de Roma", "Estatua de la Libertad", "Cristo Redentor", "Big Ben", "Torre de Pisa",
    "Acrópolis", "Partenón", "Gran Muralla China", "Taj Mahal", "Pirámides de Giza",
    "Templo Angkor Wat", "Machu Picchu", "Petra", "Chichén Itzá", "Stonehenge",
    "Sagrada Familia", "Acueducto de Segovia", "Alhambra", "Mezquita de Córdoba",
    "Catedral de Notre Dame", "Sacré Coeur", "Arco del Triunfo", "Catedral de Colonia",
    "Castillo de Neuschwanstein", "Mont Saint-Michel", "Atomium", "Manneken Pis",
    "Palacio de Versalles", "Ópera de Sídney", "Puerta de Brandeburgo", "Catedral de San Basilio",
    "Kremlin", "Ciudad Prohibida", "Burj Khalifa", "Mezquita Azul", "Hagia Sofia",
    "Empire State Building", "Chrysler Building", "Golden Gate", "Cataratas del Niágara",
    "Mount Rushmore", "Times Square", "Brooklyn Bridge", "Tower Bridge", "Castillo de Edimburgo",
    "Castillo de Praga", "Puente Carlos", "Westminster", "Casa Blanca", "Capitolio de Washington",
  ],
  "geo-ciudades": [
    "París", "Londres", "Roma", "Berlín", "Madrid", "Lisboa", "Ámsterdam", "Bruselas",
    "Viena", "Praga", "Budapest", "Varsovia", "Estocolmo", "Copenhague", "Oslo", "Helsinki",
    "Dublín", "Edimburgo", "Atenas", "Estambul", "Moscú", "San Petersburgo", "Kiev",
    "Belgrado", "Bucarest", "Zagreb", "Sofía", "Reikiavik", "Riga", "Tallin", "Vilnius",
    "Nueva York", "Los Ángeles", "Chicago", "San Francisco", "Boston", "Washington",
    "Miami", "Las Vegas", "Toronto", "Vancouver", "Montreal", "Ciudad de México", "La Habana",
    "Buenos Aires", "Río de Janeiro", "São Paulo", "Bogotá", "Lima", "Santiago de Chile",
    "Caracas", "Quito", "Montevideo", "Tokio", "Kioto", "Osaka", "Hiroshima", "Seúl", "Pekín",
    "Shanghái", "Hong Kong", "Singapur", "Bangkok", "Mumbai", "Nueva Delhi", "Dubái",
    "Doha", "Casablanca", "El Cairo", "Marrakech", "Johannesburgo", "Ciudad del Cabo",
    "Nairobi", "Sídney", "Melbourne", "Auckland", "Florencia", "Venecia", "Milán",
    "Nápoles", "Múnich", "Barcelona", "Sevilla", "Valencia", "Bilbao",
  ],
  "geo-paises": [
    "España", "Francia", "Portugal", "Italia", "Alemania", "Reino Unido", "Irlanda",
    "Países Bajos", "Bélgica", "Luxemburgo", "Suiza", "Austria", "Polonia", "Chequia",
    "Eslovaquia", "Hungría", "Rumanía", "Bulgaria", "Grecia", "Croacia", "Eslovenia",
    "Serbia", "Bosnia y Herzegovina", "Albania", "Macedonia del Norte", "Suecia", "Noruega",
    "Finlandia", "Dinamarca", "Islandia", "Estonia", "Letonia", "Lituania", "Bielorrusia",
    "Rusia", "Ucrania", "Turquía", "Estados Unidos", "Canadá", "México", "Cuba", "Argentina",
    "Brasil", "Colombia", "Venezuela", "Perú", "Chile", "Bolivia", "Ecuador", "Uruguay",
    "Paraguay", "China", "Japón", "Corea del Sur", "Corea del Norte", "India", "Pakistán",
    "Vietnam", "Tailandia", "Indonesia", "Filipinas", "Malasia", "Singapur", "Israel",
    "Arabia Saudí", "Emiratos Árabes Unidos", "Egipto", "Marruecos", "Argelia", "Sudáfrica",
    "Nigeria", "Kenia", "Etiopía", "Ghana", "Australia", "Nueva Zelanda",
  ],
  "geo-capitales": [
    "Madrid", "París", "Londres", "Roma", "Berlín", "Lisboa", "Bruselas", "Ámsterdam",
    "Berna", "Viena", "Estocolmo", "Oslo", "Copenhague", "Helsinki", "Dublín", "Atenas",
    "Varsovia", "Praga", "Budapest", "Bucarest", "Sofía", "Belgrado", "Zagreb", "Liubliana",
    "Sarajevo", "Tirana", "Skopie", "Reikiavik", "Riga", "Tallin", "Vilnius", "Minsk",
    "Moscú", "Kiev", "Ankara", "Washington D.C.", "Ottawa", "Ciudad de México", "La Habana",
    "Buenos Aires", "Brasilia", "Santiago de Chile", "Lima", "Bogotá", "Caracas", "Quito",
    "La Paz", "Asunción", "Montevideo", "Tokio", "Pekín", "Seúl", "Hanói", "Bangkok",
    "Yakarta", "Manila", "Kuala Lumpur", "Singapur", "Nueva Delhi", "Islamabad", "Daca",
    "Teherán", "Riad", "Doha", "Jerusalén", "El Cairo", "Rabat", "Argel", "Túnez",
    "Pretoria", "Nairobi", "Lagos", "Adís Abeba", "Canberra", "Wellington",
  ],
  // === Fútbol ===
  "fut-clubes-espana": [
    "Real Madrid", "FC Barcelona", "Atlético de Madrid", "Athletic Club", "Real Sociedad",
    "Sevilla FC", "Real Betis", "Villarreal CF", "Valencia CF", "Celta de Vigo", "RCD Mallorca",
    "CA Osasuna", "UD Las Palmas", "RCD Espanyol", "Getafe CF", "CD Leganés", "Rayo Vallecano",
    "Real Valladolid", "Girona FC", "Deportivo Alavés", "Cádiz CF", "Granada CF", "UD Almería",
    "CD Eldense", "CD Mirandés", "SD Eibar", "Albacete BP", "Burgos CF", "FC Cartagena",
    "CD Castellón", "Levante UD", "Málaga CF", "Real Oviedo", "Racing de Ferrol",
    "Racing de Santander", "Sporting de Gijón", "CD Tenerife", "Real Zaragoza", "FC Andorra",
    "Córdoba CF", "SD Huesca", "Elche CF", "Real Madrid Castilla",
  ],
  "fut-clubes-europa": [
    "Manchester United", "Manchester City", "Liverpool FC", "Chelsea FC", "Arsenal FC",
    "Tottenham Hotspur", "Newcastle United", "Aston Villa", "Everton FC", "West Ham United",
    "Leicester City", "Bayern de Múnich", "Borussia Dortmund", "RB Leipzig", "Bayer Leverkusen",
    "Eintracht Frankfurt", "VfL Wolfsburg", "Schalke 04", "Hertha Berlin", "Werder Bremen",
    "Borussia Mönchengladbach", "VfB Stuttgart", "Union Berlin", "Juventus", "Inter de Milán",
    "AC Milan", "AS Roma", "Lazio", "SSC Napoli", "Fiorentina", "Atalanta", "Torino",
    "Bolonia", "Paris Saint-Germain", "Olympique de Marsella", "Olympique de Lyon",
    "AS Monaco", "LOSC Lille", "OGC Niza", "Stade Rennais", "Ajax", "PSV Eindhoven",
    "Feyenoord", "FC Porto", "SL Benfica", "Sporting CP", "Galatasaray", "Fenerbahçe",
    "Beşiktaş", "Olympiacos", "Panathinaikos", "Celtic FC", "Rangers FC", "Anderlecht",
    "Club Brujas", "FC Basilea", "Salzburgo", "Sparta Praga", "Slavia Praga", "Estrella Roja",
    "Dinamo Zagreb", "Shakhtar Donetsk", "Dinamo de Kiev",
  ],
  "fut-selecciones": [
    "España", "Francia", "Alemania", "Italia", "Inglaterra", "Portugal", "Bélgica",
    "Países Bajos", "Croacia", "Polonia", "Suiza", "Austria", "Suecia", "Dinamarca", "Noruega",
    "Hungría", "Rumanía", "Grecia", "Turquía", "Rusia", "Ucrania", "Serbia", "Escocia",
    "Gales", "Irlanda", "Brasil", "Argentina", "Uruguay", "Chile", "Colombia", "Perú",
    "Ecuador", "Paraguay", "Venezuela", "Bolivia", "México", "Estados Unidos", "Canadá",
    "Costa Rica", "Honduras", "Jamaica", "Japón", "Corea del Sur", "Australia", "Arabia Saudí",
    "Irán", "Catar", "Marruecos", "Senegal", "Nigeria", "Ghana", "Camerún", "Costa de Marfil",
    "Egipto", "Sudáfrica", "Túnez", "Argelia",
  ],
  "fut-estadios": [
    "Santiago Bernabéu", "Spotify Camp Nou", "Cívitas Metropolitano", "San Mamés", "Reale Arena",
    "Sánchez Pizjuán", "Benito Villamarín", "La Cerámica", "Mestalla", "Balaídos",
    "Coliseum Alfonso Pérez", "Estadio de Vallecas", "Cornellà-El Prat",
    "Nuevo Mirandilla", "Wanda Metropolitano", "Old Trafford", "Etihad Stadium", "Anfield",
    "Stamford Bridge", "Emirates Stadium", "Tottenham Hotspur Stadium", "London Stadium",
    "St. James Park", "Allianz Arena", "Signal Iduna Park", "Red Bull Arena", "Olympiastadion",
    "Allianz Stadium", "San Siro", "Stadio Olimpico", "Diego Armando Maradona",
    "Stadio Artemio Franchi", "Parc des Princes", "Vélodrome", "Groupama Stadium",
    "Estádio do Dragão", "Estádio da Luz", "José Alvalade", "Johan Cruyff Arena",
    "Philips Stadion", "De Kuip", "Maracaná", "La Bombonera", "Monumental de Núñez",
    "Mineirão", "Morumbí", "Centenario", "Estadio Azteca", "Wembley Stadium", "Stade de France",
  ],
  "fut-leyendas": [
    "Pelé", "Diego Armando Maradona", "Cristiano Ronaldo", "Lionel Messi", "Zinedine Zidane",
    "Ronaldo Nazário", "Ronaldinho", "Romário", "Rivaldo", "Cafú", "Roberto Carlos",
    "Franz Beckenbauer", "Gerd Müller", "Eusébio", "Johan Cruyff", "Marco van Basten",
    "Ruud Gullit", "Franco Baresi", "Paolo Maldini", "Alessandro Del Piero", "Gianluigi Buffon",
    "Fabio Cannavaro", "Andrea Pirlo", "Francesco Totti", "Filippo Inzaghi", "Roberto Baggio",
    "Andrés Iniesta", "Xavi Hernández", "Iker Casillas", "Carles Puyol", "Sergio Ramos",
    "Raúl González", "Fernando Hierro", "Fernando Torres", "David Villa", "Luis Aragonés",
    "Luis Suárez", "Edinson Cavani", "Diego Forlán", "Thierry Henry", "Michel Platini",
    "Eric Cantona", "David Beckham", "Steven Gerrard", "Frank Lampard", "Paul Scholes",
    "Ryan Giggs", "Michael Owen", "Alan Shearer", "Dennis Bergkamp", "Patrick Vieira",
    "Robert Pirès", "Didier Drogba", "Samuel Eto'o", "George Weah", "Bobby Charlton",
    "Hugo Sánchez",
  ],
  "fut-conceptos": [
    "Gol", "Falta", "Penalti", "Tarjeta amarilla", "Tarjeta roja", "Córner", "Saque de banda",
    "Fuera de juego", "Centro", "Pase", "Tiro libre", "Cabezazo", "Chilena", "Vaselina",
    "Sombrero", "Túnel", "Caño", "Regate", "Asistencia", "Mano", "Hat-trick", "Pichichi",
    "Zamora", "Liga", "Copa del Rey", "Supercopa", "Champions League", "Europa League",
    "Conference League", "Mundial", "Eurocopa", "Copa América", "FIFA", "UEFA", "VAR",
    "Árbitro", "Asistente", "Cuarto árbitro", "Banquillo", "Convocatoria", "Once titular",
    "Sistema 4-3-3", "Pretemporada", "Mercado de fichajes", "Cláusula", "Traspaso", "Cesión",
    "Sustitución", "Portería", "Larguero", "Palo", "Red", "Saque inicial", "Tiempo añadido",
  ],
  // === Basket ===
  "basket-acb": [
    "Real Madrid Baloncesto", "FC Barcelona Baloncesto", "Baskonia", "Valencia Basket",
    "Unicaja Málaga", "Joventut Badalona", "San Pablo Burgos", "Casademont Zaragoza",
    "Lenovo Tenerife", "Río Breogán", "BAXI Manresa", "Surne Bilbao Basket", "Gran Canaria",
    "MoraBanc Andorra", "Bàsquet Girona", "UCAM Murcia", "Coviran Granada", "Carplus Fuenlabrada",
    "Estudiantes", "Real Betis Baloncesto", "CB Granada", "Obradoiro", "Joventut",
    "Hereda San Pablo Burgos", "ICL Manresa", "Hierros Díaz Miranda", "Movistar Estudiantes",
    "Spar Citylift Girona", "Murcia UCAM",
  ],
  "basket-nba": [
    "Los Angeles Lakers", "Boston Celtics", "Chicago Bulls", "Golden State Warriors",
    "Brooklyn Nets", "New York Knicks", "Philadelphia 76ers", "Miami Heat", "Milwaukee Bucks",
    "Cleveland Cavaliers", "Detroit Pistons", "Indiana Pacers", "Toronto Raptors",
    "Atlanta Hawks", "Charlotte Hornets", "Orlando Magic", "Washington Wizards",
    "Oklahoma City Thunder", "Portland Trail Blazers", "Utah Jazz", "Denver Nuggets",
    "Minnesota Timberwolves", "Phoenix Suns", "Sacramento Kings", "Dallas Mavericks",
    "Houston Rockets", "San Antonio Spurs", "Memphis Grizzlies", "New Orleans Pelicans",
    "Los Angeles Clippers",
  ],
  "basket-leyendas": [
    "Michael Jordan", "Kobe Bryant", "LeBron James", "Magic Johnson", "Larry Bird",
    "Kareem Abdul-Jabbar", "Wilt Chamberlain", "Bill Russell", "Tim Duncan", "Shaquille O'Neal",
    "Hakeem Olajuwon", "Karl Malone", "Charles Barkley", "John Stockton", "Scottie Pippen",
    "Isiah Thomas", "Patrick Ewing", "David Robinson", "Kevin Garnett", "Allen Iverson",
    "Steve Nash", "Dirk Nowitzki", "Manu Ginóbili", "Tony Parker", "Pau Gasol", "Marc Gasol",
    "Ricky Rubio", "Juan Carlos Navarro", "Felipe Reyes", "Rudy Fernández", "Sergio Llull",
    "Drazen Petrovic", "Toni Kukoč", "Arvydas Sabonis", "Vlade Divac", "Yao Ming",
    "Dikembe Mutombo", "Reggie Miller", "Ray Allen", "Tracy McGrady", "Vince Carter",
    "Carmelo Anthony", "Dwyane Wade", "Chris Paul", "Penny Hardaway", "Grant Hill",
    "Jason Kidd", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo", "Nikola Jokić",
    "Luka Dončić", "Joel Embiid", "Jayson Tatum",
  ],
  "basket-conceptos": [
    "Triple", "Mate", "Tapón", "Rebote", "Asistencia", "Robo", "Falta personal",
    "Falta técnica", "Falta antideportiva", "Tiro libre", "Bandeja", "Suspensión", "Pivote",
    "Base", "Escolta", "Alero", "Ala-pívot", "Bloqueo directo", "Pick and roll", "Isolación",
    "Doble equipo", "Defensa zonal", "Defensa individual", "Contraataque", "Posesión",
    "24 segundos", "Pasos", "Dobles", "Campo atrás", "3 segundos", "5 segundos", "Cuarto",
    "Prórroga", "Tiempo muerto", "Sustitución", "NBA", "ACB", "Euroliga", "FIBA",
    "Olimpiadas", "MVP", "Rookie", "Finales", "Playoffs", "Draft", "All-Star",
    "Concurso de Mates", "Cesta", "Aro", "Tablero",
  ],
  // === Arte ===
  "arte-pintores": [
    "Pablo Picasso", "Francisco de Goya", "Diego Velázquez", "Salvador Dalí", "Joan Miró",
    "Bartolomé Esteban Murillo", "El Greco", "Francisco de Zurbarán", "Joaquín Sorolla",
    "Leonardo da Vinci", "Miguel Ángel", "Rafael Sanzio", "Donatello", "Sandro Botticelli",
    "Caravaggio", "Tiziano", "Rembrandt", "Johannes Vermeer", "Vincent van Gogh",
    "Claude Monet", "Édouard Manet", "Pierre-Auguste Renoir", "Edgar Degas", "Paul Cézanne",
    "Paul Gauguin", "Edvard Munch", "Gustav Klimt", "Wassily Kandinsky", "Henri Matisse",
    "Marc Chagall", "Jackson Pollock", "Andy Warhol", "Roy Lichtenstein", "Mark Rothko",
    "Edward Hopper", "Frida Kahlo", "Diego Rivera", "Fernando Botero", "Banksy",
    "Katsushika Hokusai", "Auguste Rodin", "Constantin Brâncuși", "Alberto Giacometti",
    "Henry Moore", "Louise Bourgeois", "Eduardo Chillida", "Jaume Plensa", "Manolo Valdés",
    "Damien Hirst", "Jeff Koons", "Jean-Michel Basquiat",
  ],
  "arte-esculturas": [
    "David (Miguel Ángel)", "La Piedad", "Moisés de Miguel Ángel", "Venus de Milo",
    "Discóbolo", "El Pensador", "El Beso de Rodin", "Estatua de la Libertad", "Cristo Redentor",
    "Esfinge de Guiza", "Coloso de Rodas", "Apolo de Belvedere", "Laocoonte",
    "Diana Cazadora", "Augusto de Prima Porta", "Niké de Samotracia",
    "Perseo con la cabeza de Medusa", "Toro Farnesio", "Éxtasis de Santa Teresa",
    "Apolo y Dafne", "Manneken Pis", "Sirenita de Copenhague", "Mount Rushmore",
    "Moais de la Isla de Pascua", "Buda de Leshan", "Madre Patria Llama",
    "Estatua de la Unidad", "Cristo del Otero", "Toro de Wall Street", "El David de Donatello",
    "Atlante de Tlaloc", "Atlante de Farnesio", "Pieta Rondanini", "Galo Moribundo",
    "Discóbolo de Mirón", "Diosa Atenea", "Hermes y Dionisos", "Doríforo",
  ],
  // === Marcas ===
  "marcas-supermercados": [
    "Mercadona", "Carrefour", "Lidl", "Aldi", "Día", "El Corte Inglés", "Alcampo",
    "Eroski", "Consum", "Caprabo", "Hipercor", "Sánchez Romero", "Costco", "Veritas",
    "Casa Ametller", "Maxi Día", "BM Supermercados", "Bonpreu", "Suma", "Spar",
    "Coviran", "Alimerka", "Charter", "Vegalsa", "Walmart", "Tesco", "Sainsbury's",
    "Asda", "Morrisons", "Whole Foods", "Trader Joe's", "Migros", "Coop", "Auchan",
    "Casino", "Monoprix", "Marks & Spencer", "Edeka", "Rewe", "Kaufland", "Penny Market",
    "Albert Heijn", "Jumbo", "Pingo Doce", "Continente", "Intermarché", "Aldi Süd",
    "Familia",
  ],
  "marcas-restaurantes": [
    "McDonald's", "Burger King", "KFC", "Subway", "Pizza Hut", "Domino's Pizza", "Telepizza",
    "Foster's Hollywood", "Five Guys", "Taco Bell", "Dunkin' Donuts", "Popeyes", "Starbucks",
    "TGB", "Carl's Jr.", "Goiko", "La Tagliatella", "VIPS", "100 Montaditos", "Lizarrán",
    "Tony Roma's", "Sagardi", "Ginos", "Honest Greens", "Pollos Asados Pepe",
    "La Mafia se sienta a la mesa", "Pasta City", "Muerde la Pasta", "La Sureña",
    "Krispy Kreme", "Tim Hortons", "Cinnabon", "Pinkberry", "Llaollao", "Wendy's",
    "In-N-Out Burger", "Shake Shack", "Panera Bread", "Olive Garden", "Outback Steakhouse",
    "IHOP", "Denny's", "Applebee's", "Red Lobster", "Chipotle", "Wagamama", "Pret a Manger",
    "Hard Rock Cafe", "Costa Coffee", "Caffè Nero",
  ],
  // === Personas ===
  "personas-carreras": [
    "Medicina", "Derecho", "Ingeniería Industrial", "Arquitectura", "Psicología", "Periodismo",
    "Economía", "Biología", "Química", "Física", "Historia", "Filosofía", "Matemáticas",
    "Informática", "Enfermería", "Farmacia", "Veterinaria", "Bellas Artes", "Educación",
    "Sociología", "Antropología", "Arqueología", "Geografía", "Geología", "Biotecnología",
    "ADE", "Marketing", "Publicidad", "Relaciones Públicas", "Turismo", "Comunicación Audiovisual",
    "Cine", "Diseño Gráfico", "Diseño de Interiores", "Música", "Danza", "Logopedia",
    "Fisioterapia", "Nutrición y Dietética", "Odontología", "Podología", "Óptica",
    "Trabajo Social", "Pedagogía", "Educación Infantil", "Educación Primaria",
    "Filología Hispánica", "Filología Inglesa", "Traducción e Interpretación",
    "Ingeniería Informática", "Ingeniería Mecánica", "Ingeniería Civil", "Ingeniería Aeronáutica",
    "Ingeniería Naval", "Ingeniería Eléctrica", "Ingeniería de Telecomunicaciones",
    "Ingeniería Química", "Ingeniería Biomédica", "Estadística", "Criminología",
  ],
  "personas-profesiones": [
    "Médico", "Abogado", "Maestro", "Enfermero", "Ingeniero", "Arquitecto", "Periodista",
    "Chef", "Bombero", "Policía", "Fontanero", "Electricista", "Carpintero", "Peluquero",
    "Dentista", "Farmacéutico", "Psicólogo", "Veterinario", "Juez", "Piloto", "Taxista",
    "Albañil", "Escritor", "Fotógrafo", "Agricultor", "Notario", "Ganadero", "Mecánico",
    "Conductor", "Cocinero", "Cerrajero", "Soldador", "Cirujano", "Anestesista", "Astronauta",
    "Carnicero", "Pescadero", "Camarero", "Frutero", "Panadero", "Repostero", "Florista",
    "Jardinero", "Sastre", "Joyero", "Bibliotecario", "Cartero", "Influencer", "Cantante",
    "Actor", "Modelo", "Mago", "Payaso", "DJ", "Programador", "Diseñador", "Cajero",
    "Comercial", "Dependiente", "Camarera", "Estanquero", "Marinero", "Buzo", "Azafata",
    "Guía turístico", "Pescador", "Apicultor",
  ],
};

function appendNew(filePath, nuevos) {
  if (!existsSync(filePath)) return { error: "no existe" };
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const seen = new Set(data.map((it) => norm(it.nombre || "")));
  let added = 0;
  for (const nombre of nuevos) {
    const key = norm(nombre);
    if (key && !seen.has(key)) {
      data.push({ nombre, imagen: "" });
      seen.add(key);
      added++;
    }
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  return { added, total: data.length };
}

console.log("\n=== CINE ===");
for (const [slug, lista] of Object.entries(cineLists)) {
  const p = join(ROOT, "public", "data", "cine", slug + ".json");
  const r = appendNew(p, lista);
  console.log(`  ${slug}: +${r.added} (total ${r.total})`);
}

console.log("\n=== MUNDO ===");
for (const [slug, lista] of Object.entries(mundoLists)) {
  const p = join(ROOT, "public", "data", "mundo", slug + ".json");
  const r = appendNew(p, lista);
  console.log(`  ${slug}: +${r.added} (total ${r.total})`);
}
