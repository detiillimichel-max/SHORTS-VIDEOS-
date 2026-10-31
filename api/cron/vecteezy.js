export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  // Vercel envia este Bearer automaticamente ao executar o Cron.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const apiKey = process.env.VECTEEZY_API_KEY;
  const accountId = process.env.VECTEEZY_ACCOUNT_ID;
  if (!apiKey || !accountId) {
    console.error(JSON.stringify({
      service: "vecteezy-daily-cron",
      date: new Date().toISOString(),
      calls: 0,
      results: 0,
      status: "missing_configuration"
    }));
    return res.status(503).json({ error: "Configuração Vecteezy ausente." });
  }

  try {
    // Uma única chamada de pesquisa por execução; sem endpoint de detalhes.
    const url = new URL(`https://api.vecteezy.com/v2/${encodeURIComponent(accountId)}/resources`);
    url.searchParams.set("term", "nature");
    url.searchParams.set("content_type", "video");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "15");
    url.searchParams.set("sort_by", "relevance");
    url.searchParams.set("family_friendly", "true");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      }
    });

    const payload = await response.json().catch(() => ({}));
    const results = response.ok && Array.isArray(payload.resources)
      ? Math.min(15, payload.resources.length)
      : 0;

    // Registrar somente métricas operacionais; nunca títulos, IDs ou URLs.
    console.log(JSON.stringify({
      service: "vecteezy-daily-cron",
      date: new Date().toISOString(),
      calls: 1,
      results,
      status: response.ok ? "success" : "upstream_error",
      upstream_status: response.status
    }));

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        calls: 1,
        status: "upstream_error",
        upstreamStatus: response.status
      });
    }

    // Os resultados são descartados ao fim da execução; nada é gravado no Blob.
    return res.status(200).json({
      success: true,
      calls: 1,
      results,
      stored: false
    });
  } catch (error) {
    console.error(JSON.stringify({
      service: "vecteezy-daily-cron",
      date: new Date().toISOString(),
      calls: 1,
      results: 0,
      status: "request_error"
    }));
    return res.status(502).json({ success: false, error: "Falha na consulta Vecteezy." });
  }
}
