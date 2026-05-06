import type { APIRoute } from "astro";
import Pusher from "pusher";

export const POST: APIRoute = async ({ request }) => {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    console.error("pusher-auth: faltan variables de entorno", { appId: !!appId, key: !!key, secret: !!secret, cluster: !!cluster });
    return new Response(JSON.stringify({ error: "Configuración del servidor incompleta" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });

  const body = await request.text();
  const params = new URLSearchParams(body);
  const socket_id = params.get("socket_id") ?? "";
  const channel_name = params.get("channel_name") ?? "";

  if (!channel_name.startsWith("private-game-")) {
    return new Response(JSON.stringify({ error: "Canal no permitido" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const auth = pusher.authorizeChannel(socket_id, channel_name);
    return new Response(JSON.stringify(auth), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("pusher-auth: error al autorizar canal", e);
    return new Response(JSON.stringify({ error: "Error al autorizar canal" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
