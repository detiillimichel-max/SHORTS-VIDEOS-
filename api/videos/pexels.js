import { list, put } from "@vercel/blob";

const CACHE_SECONDS = 5 * 24 * 60 * 60;
const CATALOG_PATH = "shorts-videos/catalogs/pexels-videos.json";
const QUERIES = ["nature", "travel", "wildlife", "ocean", "space", "technology", "architecture", "sports"];
const MAX_BATCH = 600;
const PAGE_SIZE = 80;

function pickVideoFile(files = []) {
  const candidates = files
    .filter(file => file.file_type === "video/mp4" && file.link)
    .sort((a, b) => (b.width || 0) - (a.width || 0));
  return candidates.find(file => (file.width || 0) <= 1920) || candidates[0] || null;
}

function normalize(video) {
  const file = pickVideoFile(video.video_files || []);
  if (!video.id || !file) return null;
  return {
    id: String(video.id),
    title: video.user?.name ? `Vídeo de ${video.user.name}` : "Vídeo do Pexels",
    description: "",
    videoUrl: file.link,
    thumbnailUrl: video.image || null,
    pageUrl: video.url || null,
    creator: video.user?.name || "Criador Pexels",
    creatorUrl: video.user?.url || "https://www.pexels.com/",
    source: "Pexels",
    width: file.width || null,
    height: file.height || null
  };
}

async function readCatalog() {
  const found = await list({ prefix: CATALOG_PATH });
  const blob = found.blobs?.find(item => item.pathname === CATALOG_PATH);
  if (!blob) return null;
  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível ler o catálogo Pexels no Blob.");
  return response.json();
}

async function fetchBatch(apiKey, catalog) {
  const pageByQuery = { ...(catalog?.pageByQuery || {}) };
  const collected = [];
  for (const query of QUERIES) {
    if (collected.length >= MAX_BATCH) break;
    const page = Math.max(1, Number(pageByQuery[query] || 1));
    const url = new URL("https://api.pexels.com/v1/videos/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { Authorization: apiKey } });
    if (!response.ok) {
      if (response.status === 429) throw new Error("Limite temporário da API Pexels atingido.");
      throw new Error(`Pexels respondeu HTTP ${response.status}.`);
    }
    const payload = await response.json();
    for (const item of payload.videos || []) {
      const normalized = normalize(item);
      if (normalized) collected.push(normalized);
      if (collected.length >= MAX_BATCH) break;
    }
    pageByQuery[query] = page >= 10 ? 1 : page + 1;
  }
  return { collected, pageByQuery };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.PEXELS_API_KEY;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!apiKey) return res.status(503).json({ error: "PEXELS_API_KEY não está configurada na Vercel." });
  if (!blobToken) return res.status(503).json({ error: "BLOB_READ_WRITE_TOKEN não está configurada na Vercel." });

  try {
    let catalog = await readCatalog();
    const now = Date.now();
    const expired = !catalog || !catalog.updatedAt || now - catalog.updatedAt >= CACHE_SECONDS * 1000;
    let refreshed = false;

    if (expired) {
      const batch = await fetchBatch(apiKey, catalog);
      const previous = catalog?.videos || [];
      const known = new Set(previous.map(video => String(video.id)));
      const additions = [];
      for (const video of batch.collected) {
        if (!known.has(video.id)) {
          known.add(video.id);
          additions.push(video);
        }
        if (additions.length >= MAX_BATCH) break;
      }
      catalog = {
        version: 1,
        source: "Pexels",
        updatedAt: now,
        nextRefreshAt: now + CACHE_SECONDS * 1000,
        pageByQuery: batch.pageByQuery,
        lastBatchAdded: additions.length,
        videos: [...previous, ...additions]
      };
      await put(CATALOG_PATH, JSON.stringify(catalog), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: CACHE_SECONDS
      });
      refreshed = true;
    }

    const requestedPage = Math.max(1, Number.parseInt(req.query?.page || "1", 10) || 1);
    const limit = Math.min(40, Math.max(1, Number.parseInt(req.query?.limit || "20", 10) || 20));
    const start = (requestedPage - 1) * limit;
    const videos = (catalog.videos || []).slice(start, start + limit);
    res.setHeader("Cache-Control", "public, s-maxage=432000, stale-while-revalidate=86400");
    return res.status(200).json({
      source: "Pexels",
      count: videos.length,
      total: catalog.videos?.length || 0,
      page: requestedPage,
      limit,
      updatedAt: catalog.updatedAt,
      nextRefreshAt: catalog.nextRefreshAt,
      lastBatchAdded: catalog.lastBatchAdded || 0,
      refreshed,
      videos
    });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Falha ao consultar o catálogo Pexels." });
  }
}
