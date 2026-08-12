import { getStore } from "@netlify/blobs";

const ID_RE = /^[A-Za-z0-9_-]{16,80}$/;
const JSON_HEADERS = { "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff" };
const store = () => getStore({ name: "lm-student-portals" });

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
      const generation = String(body.generation || "");
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(generation)) {
        return Response.json({ error:"Generación inválida." }, { status:400, headers:JSON_HEADERS });
      }
      const partSizes = Array.isArray(body.partSizes) ? body.partSizes.map(Number) : [];
      if (
        partSizes.length !== total ||
        partSizes.some(size => !Number.isInteger(size) || size < 1 || size > 900 * 1024)
      ) {
        return Response.json({ error:"Tamaños de partes inválidos." }, { status:400, headers:JSON_HEADERS });
      }
      const meta = {
        generation,
        total,
        partSizes,
        iv: String(body.iv || ""),
        encoding: body.encoding === "gzip" ? "gzip" : "plain",
        studentName: String(body.studentName || "Alumno").slice(0, 120),
        updatedAt: String(body.updatedAt || new Date().toISOString()),
        cipherBytes: Number(body.cipherBytes || 0),
        version: 409
      };
      if (!meta.iv || !/^[A-Za-z0-9_-]{12,40}$/.test(meta.iv)) {
        return Response.json({ error:"IV inválido." }, { status:400, headers:JSON_HEADERS });
      }
      if (!Number.isFinite(meta.cipherBytes) || meta.cipherBytes < 1 || meta.cipherBytes > 80 * 1024 * 1024) {
        return Response.json({ error:"Tamaño cifrado inválido." }, { status:400, headers:JSON_HEADERS });
      }
      const expectedCipherBytes = partSizes.reduce((sum, size) => sum + size, 0);
      if (expectedCipherBytes !== meta.cipherBytes) {
        return Response.json({ error:"El tamaño total no coincide con las partes recibidas." }, { status:400, headers:JSON_HEADERS });
      }

      // Confirmar que TODAS las partes existen antes de publicar la nueva generación.
      const blobStore = store();
      for (let part = 0; part < total; part++) {
        const key = `${id}/${generation}/part-${String(part).padStart(3,"0")}`;
        const entry = await blobStore.getMetadata(key, { consistency:"strong" });
        if (!entry) {
          return Response.json({ error:`Falta la parte ${part + 1} de ${total}. La actualización no fue publicada.` }, { status:409, headers:JSON_HEADERS });
        }
        const storedSize = Number(entry.size ?? entry.contentLength ?? entry.metadata?.size ?? 0);
        if (storedSize && storedSize !== partSizes[part]) {
          return Response.json({ error:`La parte ${part + 1} quedó incompleta. La actualización no fue publicada.` }, { status:409, headers:JSON_HEADERS });
        }
      }

      // Solo después de verificar todas las partes se cambia el puntero activo.
      const previousMeta = await blobStore.get(`${id}/meta`, { type:"json", consistency:"strong" });
      await blobStore.setJSON(`${id}/meta`, meta);

      // Limpiar generaciones antiguas después del commit exitoso.
      // Si la limpieza falla, no invalida la publicación recién confirmada.
      try {
        const activePrefix = `${id}/${generation}/`;
        const generationKeyRe = new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/[A-Za-z0-9_-]{8,80}/part-\\d{3}$`);
        // Netlify Blobs list() pagina automáticamente por defecto y devuelve
        // todos los resultados. No usar cursor/hasMore: esa no es la API actual.
        const page = await blobStore.list({ prefix:`${id}/` });
        const obsoleteKeys = page.blobs
          .map(x => x.key)
          .filter(key =>
            generationKeyRe.test(key) &&
            !key.startsWith(activePrefix)
          );

        for (const key of obsoleteKeys) {
          await blobStore.delete(key);
        }
      } catch (cleanupError) {
        console.warn("portal-save cleanup", cleanupError);
      }

      return Response.json({ ok:true, id, total, generation, replacedGeneration: previousMeta?.generation || null }, { headers:JSON_HEADERS });
    }

    const id = String(url.searchParams.get("id") || "");
    const generation = String(url.searchParams.get("generation") || "");
    const part = Number(url.searchParams.get("part"));
    const total = Number(url.searchParams.get("total"));
    if (!ID_RE.test(id) || !/^[A-Za-z0-9_-]{8,80}$/.test(generation) || !Number.isInteger(part) || part < 0 || !Number.isInteger(total) || total < 1 || total > 100 || part >= total) {
      return Response.json({ error:"Parte inválida." }, { status:400, headers:JSON_HEADERS });
    }
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 900 * 1024) {
      return Response.json({ error:"Tamaño de parte inválido." }, { status:413, headers:JSON_HEADERS });
    }
    await store().set(`${id}/${generation}/part-${String(part).padStart(3,"0")}`, buf);
    return Response.json({ ok:true, part }, { headers:JSON_HEADERS });
  } catch (e) {
    console.error("portal-save", e);
    return Response.json({ error:"No se pudo guardar el Portal." }, { status:500, headers:JSON_HEADERS });
  }
};
