export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.COVERR_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "COVERR_API_KEY não está configurada na Vercel." });

  const query = String(req.query?.q || "").trim().slice(0, 100);
  const page = Math.max(0, Number.parseInt(req.query?.page || "0", 10) || 0);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit || "20", 10) || 20));

  try {
    const url = new URL("https://api.coverr.co/audios");
    if (query) url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("sort", "popular");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
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

    const hits = Array.isArray(payload.hits) ? payload.hits : Array.isArray(payload.audios) ? payload.audios : [];
    const audios = hits.map(item => ({
      id: String(item.id || ""),
      title: item.title || item.name || "Música da Coverr",
      description: item.description || "",
      duration: Number(item.duration) || null,
      genres: Array.isArray(item.genres) ? item.genres : [],
      instruments: Array.isArray(item.instruments) ? item.instruments : [],
      moods: Array.isArray(item.moods) ? item.moods : [],
      tempo: item.tempo || null,
      waveform: Array.isArray(item.waveform) ? item.waveform : [],
      isPremium: item.isPremium === true,
      previewUrl: item.urls?.preview || null,
      previewDownloadUrl: item.urls?.previewDownload || null,
      downloadUrl: item.urls?.masterDownload || null,
      pageUrl: item.slug ? `https://coverr.co/music/${encodeURIComponent(item.slug)}` : "https://coverr.co/"
    })).filter(item => item.id);

    return res.status(200).json({
      source: "Coverr",
      count: audios.length,
      page: payload.page ?? page,
      requestedPageSize: pageSize,
      actualPageSize: payload.page_size ?? null,
      pages: payload.pages ?? null,
      total: payload.total ?? null,
      audios
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Falha ao consultar a API de músicas Coverr." });
  }
}
