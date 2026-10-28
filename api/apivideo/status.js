export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.APIVIDEO_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "APIVIDEO_API_KEY não está configurada na Vercel." });

  const videoId = typeof req.query.videoId === "string" ? req.query.videoId.trim() : "";
  if (!videoId || !/^[A-Za-z0-9_-]{5,100}$/.test(videoId)) {
    return res.status(400).json({ error: "Informe um videoId válido." });
  }

  try {
    const response = await fetch(`https://ws.api.video/videos/${encodeURIComponent(videoId)}/status`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    });
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({
        error: response.status === 404 ? "Vídeo não encontrado no api.video." : "Não foi possível consultar o processamento do vídeo."
      });
    }
    const data = await response.json();
    const qualities = Array.isArray(data.encoding?.qualities) ? data.encoding.qualities : [];
    const encodingFailed = qualities.length > 0 && qualities.every(item => item.status === "failed");
    return res.status(200).json({
      videoId,
      ingestStatus: data.ingest?.status || "unknown",
      playable: data.encoding?.playable === true,
      encodingFailed,
      qualities: qualities.map(item => ({
        type: item.type || null,
        quality: item.quality || null,
        status: item.status || "unknown"
      }))
    });
  } catch {
    return res.status(502).json({ error: "Falha de conexão com api.video." });
  }
}