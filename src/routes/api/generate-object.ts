/**
 * Gera imagem realista de objeto (cuba, cooktop, etc) via Lovable AI e
 * salva em `materials-textures/<userId>/objects/<objectId>.png`.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-object")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          objectId: string;
          prompt: string;
          accessToken: string;
        };
        if (!body?.objectId || !body?.prompt || !body?.accessToken) {
          return new Response("Missing fields", { status: 400 });
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [{
              role: "user",
              content: `Photorealistic product photo, top-down view centered on pure white background, no shadows, no text, no watermark, high resolution: ${body.prompt}.`,
            }],
            modalities: ["image", "text"],
          }),
        });
        if (!aiRes.ok) return new Response(`AI error: ${await aiRes.text()}`, { status: aiRes.status });
        const aiJson = await aiRes.json() as { data?: Array<{ b64_json?: string }> };
        const b64 = aiJson.data?.[0]?.b64_json;
        if (!b64) return new Response("AI returned no image", { status: 502 });

        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const projectUrl = process.env.SUPABASE_URL!;
        const userRes = await fetch(`${projectUrl}/auth/v1/user`, {
          headers: {
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
            Authorization: `Bearer ${body.accessToken}`,
          },
        });
        if (!userRes.ok) return new Response("Auth invalid", { status: 401 });
        const user = await userRes.json() as { id: string };
        const path = `${user.id}/objects/${body.objectId}.png`;

        const upRes = await fetch(`${projectUrl}/storage/v1/object/materials-textures/${path}`, {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
            Authorization: `Bearer ${body.accessToken}`,
            "Content-Type": "image/png",
            "x-upsert": "true",
          },
          body: bytes,
        });
        if (!upRes.ok) return new Response(`Upload failed: ${await upRes.text()}`, { status: 500 });

        const signRes = await fetch(`${projectUrl}/storage/v1/object/sign/materials-textures/${path}`, {
          method: "POST",
          headers: {
            apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
            Authorization: `Bearer ${body.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
        });
        const sign = await signRes.json() as { signedURL?: string };
        const url = sign.signedURL ? `${projectUrl}/storage/v1${sign.signedURL}` : null;

        return Response.json({ path, url });
      },
    },
  },
});
