export default async (req) => {
  const url = new URL(req.url);
  const id = String(url.searchParams.get("id") || "");
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(id)) return new Response("Invalid id", { status:400 });
  const manifest = {
    id: `/p/${id}`,
    name: "Mi Linares Method",
    short_name: "Mi Linares Method",
    description: "Portal personal de entrenamiento Linares Method",
    start_url: `/p/${id}`,
    scope: "/p/",
    display: "standalone",
    background_color: "#07060d",
    theme_color: "#090711",
    orientation: "portrait",
    prefer_related_applications: false,
    icons: [
      { src:"/portal/icon-192.png", sizes:"192x192", type:"image/png", purpose:"any" },
      { src:"/portal/icon-512.png", sizes:"512x512", type:"image/png", purpose:"any" },
      { src:"/portal/icon-maskable-192.png", sizes:"192x192", type:"image/png", purpose:"maskable" },
      { src:"/portal/icon-maskable-512.png", sizes:"512x512", type:"image/png", purpose:"maskable" }
    ]
  };
  return new Response(JSON.stringify(manifest), {
    headers:{ "Content-Type":"application/manifest+json; charset=utf-8", "Cache-Control":"no-store" }
  });
};
