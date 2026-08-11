import { getStore } from "@netlify/blobs";

const ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const store = () => getStore({ name: "lm-student-portals", consistency: "strong" });

export default async (req) => {
  try {
    const url = new URL(req.url);
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    if (url.searchParams.get("commit") === "1") {
      const body = await req.json();
      const id = String(body.id || "");
      const total = Number(body.total || 0);
      if (!ID_RE.test(id) || !Number.isInteger(total) || total < 1 || total > 100) {
        return Response.json({ error: "Datos de publicación inválidos." }, { status: 400 });
      }
      const meta = {
        total,
        iv: String(body.iv || ""),
        encoding: body.encoding === "gzip" ? "gzip" : "plain",
        studentName: String(body.studentName || "Alumno").slice(0, 120),
        updatedAt: String(body.updatedAt || new Date().toISOString()),
        cipherBytes: Number(body.cipherBytes || 0),
        version: 40
      };
      if (!meta.iv) return Response.json({ error:"Falta IV." }, { status:400 });
      await store().setJSON(`${id}/meta`, meta);
      return Response.json({ ok:true, id, total });
    }

    const id = String(url.searchParams.get("id") || "");
    const part = Number(url.searchParams.get("part"));
    const total = Number(url.searchParams.get("total"));
    if (!ID_RE.test(id) || !Number.isInteger(part) || part < 0 || !Number.isInteger(total) || total < 1 || total > 100 || part >= total) {
      return Response.json({ error:"Parte inválida." }, { status:400 });
    }
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 900 * 1024) {
      return Response.json({ error:"Tamaño de parte inválido." }, { status:413 });
    }
    await store().set(`${id}/part-${String(part).padStart(3,"0")}`, buf);
    return Response.json({ ok:true, part });
  } catch (e) {
    console.error("portal-save", e);
    return Response.json({ error:"No se pudo guardar el Portal." }, { status:500 });
  }
};
