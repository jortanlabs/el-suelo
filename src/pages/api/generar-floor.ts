import type { APIRoute } from "astro";
import Anthropic from "@anthropic-ai/sdk";
import {
  categoriaFloorBySlug,
} from "../../data/categoriasFloor.ts";
import {
  resolverNombres,
  type ItemFloor,
} from "../../lib/wikidata.ts";

const SYSTEM_PROMPT = `Eres un asistente que genera listas de items reconocibles para un juego visual tipo "The Floor".

Para una categoría dada, devuelves una lista de **50 nombres** de items que:
- Sean **lo suficientemente famosos** para que cualquiera adulto los reconozca por una imagen.
- Tengan **artículo en Wikipedia** (en español o inglés) — si dudas, descarta.
- Sean **identificables visualmente** (no abstractos como "felicidad" o "paz").
- Sean **diversos** dentro de la categoría (no todos del mismo país, época o subcategoría).

Devuelve los nombres **en español** cuando exista nombre español (ej. "León africano", "Torre Eiffel", "Mona Lisa", "Lionel Messi").
Para categorías de **especies** (animales, plantas, peces, aves, hongos…): usa SIEMPRE el nombre común en español, NUNCA el nombre científico latino. Ej: "Roble común" (no "Quercus robur"), "Margarita" (no "Bellis perennis"), "Trucha común" (no "Salmo trutta"), "Flamenco rosa" (no "Phoenicopterus roseus").
Usa el **nombre oficial y completo**: evita nombres cortos o ambiguos. Escribe "Fuente de la Cibeles" en lugar de "Cibeles", "Palacio Real de Madrid" en lugar de "Palacio Real". El nombre debe ser suficientemente específico para que una búsqueda en Wikipedia devuelva exactamente ese item y no otro.
Para categorías sobre **logos, logotipos, marcas o empresas**: genera el NOMBRE DE LA MARCA o EMPRESA directamente (ej. "Apple", "Nike", "Coca-Cola", "McDonald's", "Adidas"), NUNCA frases descriptivas como "Logo de Apple" o "Logotipo de Nike". El juego mostrará la imagen y el jugador tiene que decir el nombre.
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

export const POST: APIRoute = async ({ request, locals }) => {
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
