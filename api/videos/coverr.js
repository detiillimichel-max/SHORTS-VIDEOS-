export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.COVERR_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "COVERR_API_KEY não está configurada na Vercel." });

  const query = String(req.query?.q || "nature").trim().slice(0, 100);
  const page = Math.max(0, Number.parseInt(req.query?.page || "0", 10) || 0);
  const pageSize = Math.min(40, Math.max(1, Number.parseInt(req.query?.limit || "20", 10) || 20));

  try {
    const url = new URL("https://api.coverr.co/videos");
    if (query) url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("sort", "popular");
    url.searchParams.set("urls", "true");

    const response = await fetch(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "A Coverr recusou a chave da API. Confira COVERR_API_KEY na Vercel."
        : response.status === 429
          ? "Limite de chamadas da Coverr atingido. Tente novamente mais tarde."
          : `Coverr respondeu HTTP ${response.status}.`;
      return res.status(response.status === 401 || response.status === 403 ? 502 : response.status)
        .json({ error: message, upstreamStatus: response.status });
    }

    const hits = Array.isArray(payload.hits) ? payload.hits : Array.isArray(payload.videos) ? payload.videos : [];
    const videos = hits.map(item => {
      const urls = item.urls || {};
      const videoUrl = urls.mp4_preview || urls.mp4 || item.mp4_preview || item.mp4 || null;
      if (!item.id || !videoUrl) return null;
      return {
        id: String(item.id),
        title: item.title || "Vídeo da Coverr",
        description: item.description || (Array.isArray(item.tags) ? item.tags.slice(0, 8).join(" · ") : ""),
        videoUrl,
        thumbnailUrl: item.thumbnail || item.poster || item.image || null,
        pageUrl: item.url || item.page_url || `https://coverr.co/videos/${encodeURIComponent(item.slug || item.id)}`,
        source: "Coverr",
        width: Number(item.width) || null,
        height: Number(item.height) || null,
        isVertical: item.is_vertical === true,
        duration: Number(item.duration) || null
      };
    }).filter(Boolean);

    return res.status(200).json({
      source: "Coverr",
      count: videos.length,
      page: payload.page ?? page,
      pages: payload.pages ?? null,
      total: payload.total ?? null,
      videos
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Falha ao consultar a API Coverr." });
  }
}
