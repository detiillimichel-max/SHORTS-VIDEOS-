export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.APIVIDEO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "APIVIDEO_API_KEY não está configurada na Vercel." });

  try {
    const response = await fetch("https://ws.api.video/videos?currentPage=1&pageSize=30&sortBy=createdAt&sortOrder=desc", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    });
    if (!response.ok) {
      return res.status(response.status === 401 ? 502 : response.status).json({
        error: response.status === 401 ? "A chave do api.video foi recusada. Confira a chave e o ambiente." : "Não foi possível consultar os vídeos."
      });
    }
    const payload = await response.json();
    const videos = (payload.data || []).map(v => ({
      videoId: v.videoId,
      title: v.title || "Vídeo do OIO Shorts",
      description: v.description || "",
      createdAt: v.createdAt || null,
      status: v.status || null,
      playerUrl: v.assets?.player || (v.videoId ? `https://embed.api.video/vod/${encodeURIComponent(v.videoId)}` : null),
      mp4Url: v.assets?.mp4 || null,
      hlsUrl: v.assets?.hls || null,
      thumbnailUrl: v.assets?.thumbnail || null,
      source: "api.video"
    })).filter(v => v.videoId && v.playerUrl);
    return res.status(200).json({ videos, count: videos.length });
  } catch {
    return res.status(502).json({ error: "Falha de conexão com api.video." });
  }
}