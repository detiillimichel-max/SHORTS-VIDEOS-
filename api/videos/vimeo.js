export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const token = process.env.VIMEO_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "VIMEO_ACCESS_TOKEN não está configurada na Vercel." });

  const query = String(req.query?.q || "short film").trim().slice(0, 120);
  const requestedPage = Number.parseInt(req.query?.page || "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(20, requestedPage)) : 1;
  const params = new URLSearchParams({
    query,
    sort: "plays",
    direction: "desc",
    per_page: "20",
    page: String(page),
    fields: "uri,name,description,duration,link,pictures,player_embed_url,privacy"
  });

  try {
    const response = await fetch(`https://api.vimeo.com/videos?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.vimeo.*+json;version=3.4" }
    });
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 502 : response.status;
      return res.status(status).json({
        error: response.status === 401 || response.status === 403
          ? "O Vimeo recusou o token ou não autorizou esta consulta. Confira as permissões do token."
          : response.status === 429
            ? "O Vimeo limitou temporariamente as consultas. Tente novamente em instantes."
            : "Não foi possível consultar vídeos no Vimeo."
      });
    }

    const payload = await response.json();
    const videos = (payload.data || []).map(video => {
      const match = String(video.uri || "").match(/\/videos\/(\d+)/);
      const id = match?.[1];
      const embedUrl = video.player_embed_url || (id ? `https://player.vimeo.com/video/${id}` : null);
      const privacy = video.privacy?.view;
      return {
        id,
        title: video.name || "Vídeo do Vimeo",
        description: video.description || "",
        duration: video.duration || null,
        pageUrl: video.link || null,
        embedUrl,
        thumbnailUrl: video.pictures?.sizes?.slice(-1)[0]?.link || null,
        source: "Vimeo",
        embeddableCandidate: Boolean(embedUrl && (privacy === "anybody" || privacy === "unlisted" || !privacy))
      };
    }).filter(video => video.id && video.embedUrl && video.embeddableCandidate);

    return res.status(200).json({ source: "Vimeo", query, count: videos.length, videos });
  } catch {
    return res.status(502).json({ error: "Falha de conexão com o Vimeo." });
  }
}
