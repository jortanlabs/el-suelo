import type { APIRoute } from "astro";
import Pusher from "pusher";

export const POST: APIRoute = async ({ request }) => {
  const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });

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

  const auth = pusher.authorizeChannel(socket_id, channel_name);
  return new Response(JSON.stringify(auth), {
    headers: { "content-type": "application/json" },
  });
};
