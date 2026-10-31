export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.VECTEEZY_API_KEY;
  const accountId = process.env.VECTEEZY_ACCOUNT_ID;
  if (!apiKey || !accountId) {
    return res.status(503).json({ error: "Configure VECTEEZY_API_KEY e VECTEEZY_ACCOUNT_ID na Vercel." });
  }

  const term = String(req.query?.q || "nature").trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(req.query?.page || "1", 10) || 1);
  const perPage = Math.min(20, Math.max(1, Number.parseInt(req.query?.limit || "12", 10) || 12));

  try {
    const url = new URL(`https://api.vecteezy.com/v2/${encodeURIComponent(accountId)}/resources`);
    url.searchParams.set("term", term);
    url.searchParams.set("content_type", "video");
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("sort_by", "relevance");
    url.searchParams.set("family_friendly", "true");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status === 401
        ? "A Vecteezy recusou a autenticação Bearer. Confira as variáveis da Vercel."
        : response.status === 402
          ? "A Vecteezy informou quota excedida."
          : `Vecteezy respondeu HTTP ${response.status}.`;
      return res.status(response.status === 401 || response.status === 402 ? 502 : response.status)
        .json({ error: message, upstreamStatus: response.status });
    }

    const videos = (payload.resources || [])
      .filter(item => item?.id && item.content_type === "video" && item.preview_url)
      .map(item => ({
        id: String(item.id),
        title: item.title || "Vídeo do Vecteezy",
        description: (item.tags || []).slice(0, 8).join(" · "),
        videoUrl: item.preview_url,
        thumbnailUrl: item.thumbnail_2x_url || item.thumbnail_url || null,
        source: "Vecteezy",
        width: Number(item.dimensions?.width) || null,
        height: Number(item.dimensions?.height) || null,
        pageUrl: `https://www.vecteezy.com/video/${encodeURIComponent(item.id)}`
      }));

    return res.status(200).json({
      source: "Vecteezy",
      count: videos.length,
      page: payload.page || page,
      total: payload.total_resources || 0,
      videos
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Falha ao consultar a API Vecteezy." });
  }
}
