/**
 * Gera uma textura realista do material via Lovable AI (Gemini image) e
 * salva no bucket `materials-textures/<userId>/<materialId>.png`.
 * Retorna URL assinada (1 ano) para uso no 3D.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/generate-texture")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          materialId: string;
          prompt: string;
          accessToken: string; // bearer do usuário para upload
        };
        if (!body?.materialId || !body?.prompt || !body?.accessToken) {
          return new Response("Missing fields", { status: 400 });
        }

        // 1) Gera imagem
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [{
              role: "user",
              content: `Photorealistic seamless tileable stone texture, top-down flat view, ${body.prompt}. Natural lighting, no shadows, high resolution, repeating pattern.`,
            }],
            modalities: ["image", "text"],
          }),
        });
        if (!aiRes.ok) {
          const t = await aiRes.text();
          return new Response(`AI error: ${t}`, { status: aiRes.status });
        }
        const aiJson = await aiRes.json() as { data?: Array<{ b64_json?: string }> };
        const b64 = aiJson.data?.[0]?.b64_json;
        if (!b64) return new Response("AI returned no image", { status: 502 });

        // 2) Decode + upload no Supabase Storage
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
        const path = `${user.id}/${body.materialId}.png`;

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
        if (!upRes.ok) {
          const t = await upRes.text();
          return new Response(`Upload failed: ${t}`, { status: 500 });
        }

        // 3) URL assinada (1 ano)
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
