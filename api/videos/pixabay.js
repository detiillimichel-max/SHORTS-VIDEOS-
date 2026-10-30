import { list, put } from "@vercel/blob";

const CACHE_SECONDS = 5 * 24 * 60 * 60;
const CATALOG_PATH = "shorts-videos/catalogs/pixabay-videos.json";
const SEARCHES = ["nature", "travel", "wildlife"];
const MAX_BATCH = 600;
const PAGE_SIZE = 200;

function normalize(video) {
  const files = video.videos || {};
  const file = [files.large, files.medium, files.small, files.tiny]
    .find(item => item?.url);
  if (!video.id || !file?.url) return null;
  return {
    id: String(video.id),
    title: (video.tags || "").split(",").slice(0, 5).join(" · ") || "Vídeo do Pixabay",
    description: video.tags || "",
    videoUrl: file.url,
    thumbnailUrl: file.thumbnail || files.medium?.thumbnail || files.small?.thumbnail || null,
    pageUrl: video.pageURL || "https://pixabay.com/videos/",
    creator: video.user || "Criador Pixabay",
    creatorUrl: video.user && video.user_id
      ? `https://pixabay.com/users/${encodeURIComponent(video.user)}-${video.user_id}/`
      : "https://pixabay.com/",
    source: "Pixabay",
    width: file.width || null,
    height: file.height || null,
    duration: video.duration || null
  };
}

async function readCatalog() {
  const found = await list({ prefix: CATALOG_PATH });
  const blob = found.blobs?.find(item => item.pathname === CATALOG_PATH);
  if (!blob) return null;
  const response = await fetch(blob.url, { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível ler o catálogo Pixabay no Blob.");
  return response.json();
}

async function fetchBatch(apiKey, catalog) {
  const pageBySearch = { ...(catalog?.pageBySearch || {}) };
  const collected = [];
  for (const search of SEARCHES) {
    if (collected.length >= MAX_BATCH) break;
    const page = Math.max(1, Number(pageBySearch[search] || 1));
    const url = new URL("https://pixabay.com/api/videos/");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", search);
    url.searchParams.set("lang", "pt");
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("video_type", "all");
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      if (response.status === 429) throw new Error("Limite temporário da API Pixabay atingido.");
      throw new Error(`Pixabay respondeu HTTP ${response.status}.`);
    }
    const payload = await response.json();
    for (const item of payload.hits || []) {
      const normalized = normalize(item);
      if (normalized) collected.push(normalized);
      if (collected.length >= MAX_BATCH) break;
    }
    pageBySearch[search] = page >= 3 ? 1 : page + 1;
  }
  return { collected, pageBySearch };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  const apiKey = process.env.PIXABAY_API_KEY;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!apiKey) return res.status(503).json({ error: "PIXABAY_API_KEY não está configurada na Vercel." });
  if (!blobToken) return res.status(503).json({ error: "BLOB_READ_WRITE_TOKEN não está configurada na Vercel." });

  let catalog = null;
  try {
    catalog = await readCatalog();
    const now = Date.now();
    const expired = !catalog || !catalog.updatedAt || now - catalog.updatedAt >= CACHE_SECONDS * 1000;
    let refreshed = false;

    if (expired) {
      try {
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
          source: "Pixabay",
          updatedAt: now,
          nextRefreshAt: now + CACHE_SECONDS * 1000,
          pageBySearch: batch.pageBySearch,
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
      } catch (refreshError) {
        if (!catalog?.videos?.length) throw refreshError;
        // Mantém o catálogo anterior se a atualização externa falhar.
      }
    }

    const requestedPage = Math.max(1, Number.parseInt(req.query?.page || "1", 10) || 1);
    const limit = Math.min(40, Math.max(1, Number.parseInt(req.query?.limit || "20", 10) || 20));
    const start = (requestedPage - 1) * limit;
    const videos = (catalog.videos || []).slice(start, start + limit);
    res.setHeader("Cache-Control", "public, s-maxage=432000, stale-while-revalidate=86400");
    return res.status(200).json({
      source: "Pixabay",
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
    return res.status(502).json({ error: error.message || "Falha ao consultar o catálogo Pixabay." });
  }
}
