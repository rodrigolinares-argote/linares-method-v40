import { getStore } from "@netlify/blobs";

const ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const store = () => getStore({ name: "lm-student-portals" });

export default async (req) => {
  try {
    if (req.method !== "GET") return new Response("Method not allowed", { status:405 });
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "");
    if (!ID_RE.test(id)) return new Response("Invalid portal id", { status:400 });

    if (url.searchParams.get("meta") === "1") {
      const meta = await store().get(`${id}/meta`, { type:"json", consistency:"strong" });
      if (!meta) return new Response("Not found", { status:404 });
      return Response.json(meta, { headers:{ "Cache-Control":"no-store" } });
    }

    if (!url.searchParams.has("part")) return new Response("Missing part", { status:400 });
    const generation = String(url.searchParams.get("generation") || "");
    const part = Number(url.searchParams.get("part"));
    if ((generation && !/^[A-Za-z0-9_-]{8,80}$/.test(generation)) || !Number.isInteger(part) || part < 0 || part > 99) {
      return new Response("Invalid part", { status:400 });
    }
    const key = generation
      ? `${id}/${generation}/part-${String(part).padStart(3,"0")}`
      : `${id}/part-${String(part).padStart(3,"0")}`;
    const data = await store().get(key, { type:"arrayBuffer", consistency:"strong" });
    if (!data) return new Response("Not found", { status:404 });
    return new Response(data, { headers:{ "Content-Type":"application/octet-stream", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" } });
  } catch (e) {
    console.error("portal-get", e);
    return new Response("Portal read error", { status:500 });
  }
};
