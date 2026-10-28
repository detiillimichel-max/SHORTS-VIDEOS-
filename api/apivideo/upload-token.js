import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-OIO-Upload-Pin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.APIVIDEO_API_KEY;
  const uploadPin = process.env.OIO_UPLOAD_PIN;
  if (!apiKey) return res.status(503).json({ error: "APIVIDEO_API_KEY não está configurada na Vercel." });
  if (!uploadPin) return res.status(503).json({ error: "Falta cadastrar OIO_UPLOAD_PIN nas variáveis da Vercel." });
  if (!safeEqual(req.headers["x-oio-upload-pin"], uploadPin)) {
    return res.status(401).json({ error: "PIN de publicação incorreto." });
  }

  try {
    const response = await fetch("https://ws.api.video/upload-tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ttl: 3600 })
    });
    if (!response.ok) {
      return res.status(502).json({ error: "api.video não conseguiu criar um token de envio. Confira a chave e o ambiente." });
    }
    const data = await response.json();
    if (!data.token) return res.status(502).json({ error: "api.video não retornou um token de envio válido." });
    return res.status(200).json({ token: data.token, expiresIn: data.ttl || 3600 });
  } catch {
    return res.status(502).json({ error: "Falha de conexão ao preparar o envio." });
  }
}