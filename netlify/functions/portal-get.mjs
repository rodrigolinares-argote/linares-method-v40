import { getStore } from "@netlify/blobs";

const ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const store = () => getStore({ name: "lm-student-portals", consistency: "strong" });

export default async (req) => {
  try {
    if (req.method !== "GET") return new Response("Method not allowed", { status:405 });
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "");
    if (!ID_RE.test(id)) return new Response("Invalid portal id", { status:400 });

    if (url.searchParams.get("meta") === "1") {
      const meta = await store().get(`${id}/meta`, { type:"json" });
      if (!meta) return new Response("Not found", { status:404 });
      return Response.json(meta, { headers:{ "Cache-Control":"no-store" } });
    }

    const part = Number(url.searchParams.get("part"));
    if (!Number.isInteger(part) || part < 0 || part > 99) return new Response("Invalid part", { status:400 });
    const data = await store().get(`${id}/part-${String(part).padStart(3,"0")}`, { type:"arrayBuffer" });
    if (!data) return new Response("Not found", { status:404 });
    return new Response(data, { headers:{ "Content-Type":"application/octet-stream", "Cache-Control":"no-store" } });
  } catch (e) {
    console.error("portal-get", e);
    return new Response("Portal read error", { status:500 });
  }
};
