(() => {
  const mount = document.querySelector("#discover-screen .category-grid");
  if (!mount || document.querySelector("#tiktok-public-panel")) return;

  const style = document.createElement("style");
  style.textContent = `
    #tiktok-public-panel{margin:0 0 16px;padding:15px;border:1px solid #ffffff17;border-radius:18px;background:linear-gradient(145deg,#171923,#101117)}
    #tiktok-public-panel .tt-heading{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    #tiktok-public-panel .tt-icon{width:37px;height:37px;border-radius:12px;background:#fe2c551c;color:#fe2c55;display:grid;place-items:center;font-size:22px;font-weight:900}
    #tiktok-public-panel h2{margin:0;font-size:13px}
    #tiktok-public-panel .tt-note{font-size:11px;line-height:1.5;color:#b8bac8;margin:8px 0 12px}
    #tiktok-public-panel .tt-form{display:flex;gap:7px}
    #tiktok-public-panel input{min-width:0;flex:1;height:42px;border:1px solid #ffffff1b;border-radius:11px;background:#090a10;color:#fff;padding:0 10px;font-size:12px}
    #tiktok-public-panel .tt-add{border:0;border-radius:11px;padding:0 13px;background:#fe2c55;color:white;font-size:12px;font-weight:800}
    #tiktok-public-panel .tt-status{font-size:11px;line-height:1.5;margin-top:9px;color:#d5d7e3}
    #tiktok-public-panel .tt-list{display:grid;gap:12px;margin-top:14px}
    #tiktok-public-panel .tt-video{overflow:hidden;border:1px solid #ffffff1b;border-radius:14px;background:#050507}
    #tiktok-public-panel .tt-video iframe{display:block;width:100%;height:min(72vh,590px);min-height:420px;border:0;background:#050507}
    #tiktok-public-panel .tt-video-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 10px;font-size:10px;color:#c8cad5}
    #tiktok-public-panel .tt-video-foot a{color:#25e6df}
    #tiktok-public-panel .tt-remove{border:1px solid #ffffff2b;border-radius:8px;background:#ffffff0c;padding:5px 8px;color:white}
    @media(max-height:620px){#tiktok-public-panel .tt-video iframe{min-height:350px;height:65vh}}
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "tiktok-public-panel";
  panel.innerHTML = `
    <div class="tt-heading"><span class="tt-icon">♪</span><div><h2>Vídeos públicos do TikTok</h2><div style="font-size:10px;color:#a1a4b4;margin-top:3px">Incorporação oficial por link</div></div></div>
    <p class="tt-note">Cole o link de um vídeo público do TikTok. Ele será exibido pelo player oficial. Este caminho não pesquisa automaticamente todos os criadores e não usa os Secrets do GitHub.</p>
    <form class="tt-form" id="tt-public-form"><input id="tt-public-url" type="url" inputmode="url" placeholder="https://www.tiktok.com/@.../video/..." aria-label="Link público de vídeo TikTok" required><button class="tt-add" type="submit">Adicionar</button></form>
    <div class="tt-status" id="tt-public-status" role="status" aria-live="polite">Os links adicionados ficam salvos neste navegador.</div>
    <div class="tt-list" id="tt-public-list"></div>
  `;
  mount.insertAdjacentElement("afterend", panel);

  const storageKey = "oioShortsPublicTikTokLinksV1";
  const status = panel.querySelector("#tt-public-status");
  const list = panel.querySelector("#tt-public-list");

  function readItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed.filter(x => x && /^\d{5,30}$/.test(String(x.id)) && typeof x.url === "string") : [];
    } catch (_) { return []; }
  }
  function saveItems(items) {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); return true; }
    catch (_) { status.textContent = "Não foi possível salvar neste navegador. Você ainda pode abrir os links no TikTok."; return false; }
  }
  function parseTikTokUrl(raw) {
    let url;
    try { url = new URL(raw); } catch (_) { return null; }
    const host = url.hostname.toLowerCase();
    if (!(host === "tiktok.com" || host.endsWith(".tiktok.com"))) return null;
    const match = url.pathname.match(/\/video\/(\d{5,30})/);
    if (!match) return null;
    return { id: match[1], url: "https://www.tiktok.com" + url.pathname };
  }
  function render() {
    const items = readItems();
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "tt-status";
      empty.textContent = "Nenhum vídeo adicionado ainda.";
      list.appendChild(empty);
      return;
    }
    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "tt-video";
      const frame = document.createElement("iframe");
      frame.src = "https://www.tiktok.com/player/v1/" + encodeURIComponent(item.id);
      frame.title = "Vídeo público do TikTok";
      frame.loading = "lazy";
      frame.allow = "fullscreen; autoplay; encrypted-media; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      const foot = document.createElement("div");
      foot.className = "tt-video-foot";
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Abrir no TikTok ↗";
      const remove = document.createElement("button");
      remove.className = "tt-remove";
      remove.type = "button";
      remove.textContent = "Remover";
      remove.addEventListener("click", () => {
        const next = readItems();
        next.splice(index, 1);
        saveItems(next);
        status.textContent = "Vídeo removido desta lista.";
        render();
      });
      foot.append(link, remove);
      card.append(frame, foot);
      list.appendChild(card);
    });
  }

  panel.querySelector("#tt-public-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = panel.querySelector("#tt-public-url");
    const parsed = parseTikTokUrl(input.value.trim());
    if (!parsed) {
      status.textContent = "Link não reconhecido. Cole o endereço completo de um vídeo, com /video/ e o número do vídeo.";
      return;
    }
    const items = readItems();
    if (items.some(item => item.id === parsed.id)) {
      status.textContent = "Esse vídeo já está na lista.";
      return;
    }
    items.unshift(parsed);
    if (!saveItems(items)) return;
    input.value = "";
    status.textContent = "Vídeo adicionado. Se o criador o tornou privado ou o removeu, o player pode não funcionar.";
    render();
  });

  render();
})();