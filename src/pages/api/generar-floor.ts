import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import {
  categoriaFloorBySlug,
} from "../../data/categoriasFloor.ts";
import {
  resolverNombres,
  type ItemFloor,
} from "../../lib/wikidata.ts";

const SYSTEM_PROMPT = `Eres un asistente que genera listas de items reconocibles para un juego visual tipo "The Floor" dirigido a hispanohablantes.

Para una categoría dada, devuelves una lista de **50 nombres** de items que:
- Sean **lo suficientemente famosos** para que cualquier adulto hispanohablante los reconozca por una imagen.
- Tengan **artículo en Wikipedia (español o inglés) con foto** — si dudas, descarta.
- Sean **identificables visualmente** (no abstractos como "felicidad" o "paz").
- Sean **diversos** dentro de la categoría (no todos del mismo país, época o subcategoría).

**IDIOMA — REGLA CRÍTICA**: Usa siempre el nombre en **español** tal como lo conoce un hispanohablante. Ejemplos: "Torre Eiffel" (no "Eiffel Tower"), "Oso polar" (no "Polar bear"), "Gran Muralla China" (no "Great Wall of China"), "Tigre" (no "Tiger"). Para nombres propios internacionales que no tienen traducción, usa el original: "Leonardo DiCaprio", "Lionel Messi", "Mickey Mouse", "Apple".

**Desambiguación**: Cuando un nombre pueda confundirse con otra cosa fuera de la categoría, añade el contexto entre paréntesis. Esto aplica a personajes de ficción Y a términos técnicos o ambiguos. Ej: "Elsa (Frozen)", "Simba (El Rey León)", "Albatros (golf)", "Eagle (golf)", "Birdie (golf)", "Bogey (golf)", "Espada (ajedrez)". El juego mostrará el nombre sin el paréntesis.

**Logos y marcas**: genera solo el NOMBRE DE LA MARCA (ej. "Apple", "Nike", "Coca-Cola").

Devuelve solo el array de strings, sin explicaciones ni numeración, usando la herramienta generar_items.`;

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "generar_items",
    description:
      "Devuelve una lista de items para la categoría proporcionada.",
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "Lista de 50 nombres famosos de la categoría.",
          items: { type: "string" },
        },
      },
      required: ["items"],
    },
  },
];

async function generarNombres(
  apiKey: string,
  categoriaLibre: string,
): Promise<string[]> {
  const client = new Anthropic({ apiKey });
  const respuesta = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 3000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools,
    tool_choice: { type: "tool", name: "generar_items" },
    messages: [
      {
        role: "user",
        content: `Categoría: "${categoriaLibre}". Genera 50 items famosos.`,
      },
    ],
  });
  const toolUse = respuesta.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("El modelo no devolvió la lista de items");
  }
  const input = toolUse.input as { items?: string[] };
  if (!input.items || input.items.length === 0) {
    throw new Error("Lista vacía");
  }
  return input.items;
}

// Rate-limit in-memory (10 req / IP / hora). Para deployments con cold-starts
// frecuentes el contador se resetea, pero suficiente para frenar abuso casual.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 10;
const rateMap = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { rateMap.set(ip, arr); return true; }
  arr.push(now); rateMap.set(ip, arr);
  // GC: si el mapa crece mucho, limpiar
  if (rateMap.size > 1000) {
    for (const [k, v] of rateMap) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) rateMap.delete(k);
    }
  }
  return false;
}

export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  // Rate limit: 10 peticiones por IP por hora
  const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Demasiadas peticiones. Espera un poco e inténtalo de nuevo." }),
      { status: 429, headers: { "content-type": "application/json", "Retry-After": "3600" } },
    );
  }

  const apiKey =
    process.env.ANTHROPIC_API_KEY ??
    (locals as unknown as { runtime?: { env?: Record<string, string> } })?.runtime?.env?.ANTHROPIC_API_KEY;

  let body: { slug?: string; libre?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body inválido" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  // Validar tamaño del campo libre para evitar abuso de tokens en Anthropic
  if (body.libre && body.libre.length > 200) {
    return new Response(JSON.stringify({ error: "Categoría demasiado larga" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }

  try {
    let items: ItemFloor[] = [];

    if (body.slug) {
      const cat = categoriaFloorBySlug(body.slug);
      if (!cat) {
        return new Response(
          JSON.stringify({ error: "Categoría desconocida" }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      if (cat.itemsHardcoded) {
        items = cat.itemsHardcoded;
      } else if (cat.nombres) {
        items = await resolverNombres(cat.nombres, 5);
      }
    } else if (body.libre && body.libre.trim().length > 0) {
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error:
              "Para categoría libre necesitas ANTHROPIC_API_KEY. Configúrala en Vercel Settings → Environment Variables → Production.",
          }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
      const nombres = await generarNombres(apiKey, body.libre.trim().slice(0, 200));
      return new Response(JSON.stringify({ nombres }), {
        headers: { "content-type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Falta slug o libre" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    if (items.length < 8) {
      return new Response(
        JSON.stringify({
          error: `Solo se han podido resolver ${items.length} items con imagen para esta categoría. Prueba otra.`,
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ items }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: mensaje }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
