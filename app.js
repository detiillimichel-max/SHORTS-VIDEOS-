(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = (message) => {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2300);
  };
  const refreshIcons = () => {
    if (window.lucide?.createIcons) window.lucide.createIcons();
  };
  refreshIcons();

  const screens = $$(".screen");
  const navItems = $$(".nav-item");
  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle("active", screen.id === id));
    navItems.forEach(button => button.classList.toggle("active", button.dataset.screen === id));
    const topbar = $(".topbar");
    topbar.classList.toggle("feed-topbar", id === "feed-screen");
    if (id !== "feed-screen") $(".video-feed")?.scrollTo({ top: 0 });
    refreshIcons();
  }
  navItems.forEach(button => button.addEventListener("click", () => showScreen(button.dataset.screen)));
  const musicEntry = $("#open-music-screen");
  const musicBack = $("#music-back");
  musicEntry?.addEventListener("click", () => showScreen("music-screen"));
  musicBack?.addEventListener("click", () => showScreen("discover-screen"));
  const coverrCatalog = $("#coverr-catalog");
  const coverrProviderGrid = $(".music-provider-grid");
  const coverrMusicNote = $(".music-note");
  const coverrAudio = new Audio();
  coverrAudio.preload = "none";
  coverrAudio.volume = 0.8;
  const coverrState = { page: 0, query: "", pages: null, total: null, tracks: [], currentIndex: -1 };
  const coverrCacheTtl = 21600000;
  const coverrStatus = $("#coverr-status");
  const coverrList = $("#coverr-track-list");
  const coverrWaveform = $("#coverr-waveform");
  const coverrPlayer = $("#coverr-player");
  const coverrPlayButton = $("#coverr-play");
  const coverrCacheKey = query => "oio_coverr_music_v1:" + (query || "__all__");
  const coverrTime = seconds => {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  };
  function coverrReadCache(query) {
    try {
      const saved = JSON.parse(localStorage.getItem(coverrCacheKey(query)) || "null");
      return saved && Date.now() - saved.time < coverrCacheTtl ? saved.data : null;
    } catch (_) { return null; }
  }
  function coverrWriteCache(query, data) {
    try { localStorage.setItem(coverrCacheKey(query), JSON.stringify({ time: Date.now(), data })); } catch (_) {}
  }
  function coverrPlaying(yes) {
    coverrPlayButton.innerHTML = yes ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
    coverrPlayButton.setAttribute("aria-label", yes ? "Pausar" : "Reproduzir");
    refreshIcons();
  }
  function coverrDrawWave(track) {
    const values = Array.isArray(track.waveform) ? track.waveform : [];
    const count = Math.min(72, Math.max(36, values.length || 48));
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const pos = values.length ? Math.min(values.length - 1, Math.floor(i * values.length / count)) : -1;
      const v = pos >= 0 ? Number(values[pos]) : 0.3;
      const bar = document.createElement("span");
      bar.className = "coverr-wave-bar";
      bar.style.height = Math.round(9 + Math.max(.08, Math.min(1, Number.isFinite(v) ? v : .3)) * 47) + "px";
      frag.appendChild(bar);
    }
    coverrWaveform.replaceChildren(frag);
    coverrWaveform.setAttribute("aria-valuenow", "0");
  }
  function coverrProgress() {
    const duration = coverrAudio.duration || coverrState.tracks[coverrState.currentIndex]?.duration || 0;
    const ratio = duration ? Math.min(1, coverrAudio.currentTime / duration) : 0;
    const bars = $(".coverr-wave-bar", coverrWaveform);
    bars.forEach((bar, i) => bar.classList.toggle("played", i < Math.round(ratio * bars.length)));
    $("#coverr-current-time").textContent = coverrTime(coverrAudio.currentTime);
    $("#coverr-total-time").textContent = coverrTime(duration);
    coverrWaveform.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
  }
  function coverrPlayTrack(index, autoplay = true) {
    const track = coverrState.tracks[index];
    if (!track) return;
    if (track.isPremium || !track.previewUrl) {
      toast(track.isPremium ? "Esta faixa é Premium na Coverr." : "Prévia indisponível.");
      return;
    }
    coverrState.currentIndex = index;
    coverrPlayer.classList.remove("hidden");
    $("#coverr-player-title").textContent = track.title || "Música Coverr";
    $("#coverr-player-subtitle").textContent = [...(track.genres || []).slice(0, 2), ...(track.instruments || []).slice(0, 2)].join(" · ") || "Coverr · Stock Music";
    $("#coverr-track-link").href = track.pageUrl || "https://coverr.co/";
    coverrDrawWave(track);
    coverrAudio.src = track.previewUrl;
    coverrAudio.load();
    coverrProgress();
    $(".coverr-track").forEach((el, i) => el.classList.toggle("selected", i === index));
    if (autoplay) coverrAudio.play().catch(() => toast("Toque em reproduzir para iniciar a prévia."));
  }
  function coverrRender() {
    const frag = document.createDocumentFragment();
    coverrState.tracks.forEach((track, index) => {
      const row = document.createElement("article");
      row.className = "coverr-track" + (track.isPremium ? " premium" : "") + (index === coverrState.currentIndex ? " selected" : "");
      const art = document.createElement("div");
      art.className = "coverr-track-art";
      art.innerHTML = '<i data-lucide="music-2"></i>';
      const info = document.createElement("div");
      info.className = "coverr-track-info";
      const title = document.createElement("b");
      title.textContent = track.title || "Música Coverr";
      const detail = document.createElement("small");
      detail.textContent = [...(track.genres || []).slice(0, 2), ...(track.instruments || []).slice(0, 1)].join(" · ") || "Stock Music";
      info.append(title, detail);
      const duration = document.createElement("small");
      duration.className = "coverr-track-duration";
      duration.textContent = coverrTime(track.duration);
      const play = document.createElement("button");
      play.type = "button";
      play.className = "coverr-track-play";
      play.disabled = track.isPremium || !track.previewUrl;
      play.innerHTML = track.isPremium ? '<i data-lucide="lock"></i>' : '<i data-lucide="play"></i>';
      play.addEventListener("click", () => coverrPlayTrack(index));
      row.append(art, info, duration, play);
      frag.appendChild(row);
    });
    coverrList.replaceChildren(frag);
    refreshIcons();
  }
  async function coverrLoad(query = coverrState.query, page = 0, append = false) {
    coverrStatus.textContent = "Carregando músicas da Coverr...";
    coverrStatus.classList.remove("error");
    if (!append) {
      coverrState.query = query;
      coverrState.page = 0;
      coverrState.tracks = [];
      coverrState.currentIndex = -1;
      coverrList.replaceChildren();
      coverrPlayer.classList.add("hidden");
      coverrAudio.pause();
      coverrAudio.removeAttribute("src");
      coverrPlaying(false);
    }
    let payload = page === 0 ? coverrReadCache(query) : null;
    try {
      if (!payload) {
        const params = new URLSearchParams({ page: String(page), limit: "100" });
        if (query) params.set("q", query);
        const response = await fetch(API_BASE + "/api/audio/coverr?" + params.toString(), { headers: { Accept: "application/json" } });
        if (!response.ok) {
          const problem = await response.json().catch(() => ({}));
          throw new Error(problem.error || "Coverr respondeu HTTP " + response.status + ".");
        }
        payload = await response.json();
        if (page === 0) coverrWriteCache(query, payload);
      }
      const incoming = Array.isArray(payload.audios) ? payload.audios : [];
      const known = new Set(coverrState.tracks.map(track => track.id));
      incoming.forEach(track => { if (!known.has(track.id)) { coverrState.tracks.push(track); known.add(track.id); } });
      coverrState.page = page;
      coverrState.total = payload.total ?? coverrState.total;
      coverrState.pages = payload.pages ?? coverrState.pages;
      $("#coverr-catalog-count").textContent = (coverrState.total ?? coverrState.tracks.length) + " faixas · " + coverrState.tracks.length + " carregadas";
      coverrStatus.textContent = coverrState.tracks.length ? "Escolha uma faixa para ouvir a prévia." : "Nenhuma música encontrada.";
      coverrRender();
      $("#coverr-load-more").classList.toggle("hidden", !(coverrState.pages ? page + 1 < coverrState.pages : incoming.length === 100));
    } catch (error) {
      coverrStatus.textContent = error.message || "Falha ao carregar Coverr.";
      coverrStatus.classList.add("error");
      toast(coverrStatus.textContent);
    }
  }
  $("#open-coverr-catalog")?.addEventListener("click", () => {
    coverrProviderGrid.classList.add("hidden");
    coverrMusicNote.classList.add("hidden");
    coverrCatalog.classList.remove("hidden");
    coverrLoad("", 0, false);
    $(".music-screen").scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#coverr-back")?.addEventListener("click", () => {
    coverrCatalog.classList.add("hidden");
    coverrProviderGrid.classList.remove("hidden");
    coverrMusicNote.classList.remove("hidden");
    coverrAudio.pause();
    coverrPlaying(false);
  });
  $("#coverr-close-player")?.addEventListener("click", () => {
    coverrAudio.pause();
    coverrPlaying(false);
    coverrPlayer.classList.add("hidden");
  });\n  $("#coverr-search-button")?.addEventListener("click", () => coverrLoad($("#coverr-search-input").value.trim(), 0, false));
  $("#coverr-search-input")?.addEventListener("keydown", e => { if (e.key === "Enter") coverrLoad(e.currentTarget.value.trim(), 0, false); });
  $("#coverr-load-more")?.addEventListener("click", () => coverrLoad(coverrState.query, coverrState.page + 1, true));
  coverrPlayButton?.addEventListener("click", () => {
    if (!coverrAudio.src) return toast("Escolha uma música na lista.");
    if (coverrAudio.paused) coverrAudio.play().catch(() => toast("Não foi possível reproduzir esta prévia."));
    else coverrAudio.pause();
  });
  $("#coverr-prev")?.addEventListener("click", () => coverrPlayTrack(Math.max(0, coverrState.currentIndex - 1)));
  $("#coverr-next")?.addEventListener("click", () => coverrPlayTrack(Math.min(coverrState.tracks.length - 1, coverrState.currentIndex + 1)));
  $("#coverr-volume")?.addEventListener("input", e => {
    coverrAudio.volume = Number(e.currentTarget.value);
    $("#coverr-volume-label").textContent = Math.round(coverrAudio.volume * 100) + "%";
  });
  coverrWaveform?.addEventListener("click", e => {
    if (!Number.isFinite(coverrAudio.duration)) return;
    const rect = coverrWaveform.getBoundingClientRect();
    coverrAudio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * coverrAudio.duration;
    coverrProgress();
  });
  coverrWaveform?.addEventListener("keydown", e => {
    if (!Number.isFinite(coverrAudio.duration) || !["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    coverrAudio.currentTime = Math.max(0, Math.min(coverrAudio.duration, coverrAudio.currentTime + (e.key === "ArrowRight" ? 5 : -5)));
    coverrProgress();
  });
  coverrAudio.addEventListener("timeupdate", coverrProgress);
  coverrAudio.addEventListener("loadedmetadata", coverrProgress);
  coverrAudio.addEventListener("play", () => coverrPlaying(true));
  coverrAudio.addEventListener("pause", () => coverrPlaying(false));
  coverrAudio.addEventListener("ended", () => {
    coverrPlaying(false);
    if (coverrState.currentIndex < coverrState.tracks.length - 1) coverrPlayTrack(coverrState.currentIndex + 1);
  });
  coverrAudio.addEventListener("error", () => { if (coverrAudio.src) toast("A prévia desta faixa não pôde ser reproduzida."); });
  $$(".feed-tab").forEach(button => button.addEventListener("click", () => {
    $$(".feed-tab").forEach(tab => tab.classList.toggle("active", tab === button));
    toast(button.dataset.feed === "following" ? "O feed Seguindo será conectado numa próxima etapa." : "Você está vendo a demonstração Para você.");
  }));

  $$(".like-action").forEach(button => button.addEventListener("click", () => {
    const liked = button.classList.toggle("liked");
    toast(liked ? "Curtida demonstrativa ❤️" : "Curtida removida");
  }));
  $$(".save-action").forEach(button => button.addEventListener("click", () => {
    const saved = button.classList.toggle("saved");
    toast(saved ? "Salvo nesta demonstração 🔖" : "Removido dos salvos");
  }));
  $$(".comment-action").forEach(button => button.addEventListener("click", () => toast("Comentários serão conectados em uma próxima etapa.")));
  $$(".share-action").forEach(button => button.addEventListener("click", async () => {
    const url = location.href.split("#")[0];
    if (navigator.share) {
      try { await navigator.share({ title: "OIO Shorts Lab", text: "Veja esta demonstração do OIO Shorts Lab", url }); }
      catch (_) {}
    } else if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(url); toast("Link copiado."); }
      catch (_) { toast("Compartilhe usando o menu do navegador."); }
    } else toast("Compartilhe usando o menu do navegador.");
  }));
  $$(".follow-button").forEach(button => button.addEventListener("click", () => {
    const followed = button.dataset.following === "true";
    button.dataset.following = String(!followed);
    button.textContent = followed ? "Seguir" : "Seguindo";
    toast(followed ? "Você deixou de seguir este perfil." : "Perfil seguido nesta demonstração.");
  }));
  $$(".sound-button").forEach(button => button.addEventListener("click", () => toast("O som será ativado quando houver vídeos reproduzíveis.")));
  $$(".more-action").forEach(button => button.addEventListener("click", () => toast("Mais opções serão adicionadas depois.")));
  const API_BASE = location.origin;
  const feedEl = $("#video-feed");
  let apiVideoIds = new Set();

  async function loadApiVideoFeed() {
    if (!feedEl || location.hostname.endsWith("github.io")) return;
    try {
      const response = await fetch(`${API_BASE}/api/apivideo/feed?refresh=${Date.now()}`, { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) return;
      const payload = await response.json();
      (payload.videos || []).forEach(video => {
        if (!video.videoId || apiVideoIds.has(video.videoId)) return;
        apiVideoIds.add(video.videoId);
        const card = document.createElement("article");
        card.className = "short-card";
        card.dataset.id = video.videoId;
        const player = document.createElement("video");
        player.className = "video-poster api-video-player";
        player.controls = true;
        player.playsInline = true;
        player.preload = "metadata";
        player.poster = video.thumbnailUrl || "";
        player.setAttribute("aria-label", video.title || "Vídeo publicado");
        player.src = video.mp4Url || "";
        if (!player.src && video.hlsUrl) player.src = video.hlsUrl;
        player.addEventListener("error", () => {
          if (video.hlsUrl && player.src !== video.hlsUrl) {
            player.src = video.hlsUrl;
            player.load();
          }
        });
        const seekBack = document.createElement("button");
        seekBack.type = "button";
        seekBack.className = "video-seek-button seek-back";
        seekBack.textContent = "↶ 10 s";
        seekBack.setAttribute("aria-label", "Voltar 10 segundos");
        seekBack.onclick = () => { player.currentTime = Math.max(0, player.currentTime - 10); };
        const seekForward = document.createElement("button");
        seekForward.type = "button";
        seekForward.className = "video-seek-button seek-forward";
        seekForward.textContent = "10 s ↷";
        seekForward.setAttribute("aria-label", "Avançar 10 segundos");
        seekForward.onclick = () => { player.currentTime = Math.min(player.duration || Infinity, player.currentTime + 10); };
        const shade = document.createElement("div");
        shade.className = "video-shade";
        const top = document.createElement("div");
        top.className = "video-topline";
        top.innerHTML = '<span class="live-pill"><span></span> OIO SHORTS</span><span class="demo-label">API.VIDEO</span>';
        const info = document.createElement("div");
        info.className = "video-info";
        const title = document.createElement("h2");
        title.textContent = video.title || "Vídeo publicado";
        const description = document.createElement("p");
        description.textContent = video.description || "Vídeo publicado no OIO Shorts.";
        info.append(title, description);
        card.append(player, seekBack, seekForward, shade, top, info);
        feedEl.appendChild(card);
      });
    } catch (_) {
      // A API fica indisponível sem interromper a interface de demonstração.
    }
  }

  async function uploadToApiVideo(file, title = "") {
    if (!file || !file.type.startsWith("video/")) throw new Error("Escolha um arquivo de vídeo.");
    if (file.size > 200 * 1024 * 1024) throw new Error("Para este teste, escolha um vídeo com menos de 200 MB.");
    toast("Preparando envio…");
    const tokenResponse = await fetch(`${API_BASE}/api/apivideo/upload-token`, {
      method: "POST",
      headers: { Accept: "application/json" }
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenData.token) throw new Error(tokenData.error || "Não foi possível preparar o envio.");
    const body = new FormData();
    body.append("file", file, file.name || "oio-shorts-video.mp4");
    const uploadResponse = await fetch(`https://ws.api.video/upload?token=${encodeURIComponent(tokenData.token)}`, {
      method: "POST", body
    });
    const uploadData = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok) throw new Error(uploadData.message || "O api.video recusou o arquivo.");
    toast("Upload recebido. Aguardando o processamento do vídeo…");

    // Aguarda o api.video informar que o vídeo já pode ser reproduzido.
    const uploadedVideoId = uploadData.videoId;
    if (uploadedVideoId) {
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
          const statusResponse = await fetch(`${API_BASE}/api/apivideo/status?videoId=${encodeURIComponent(uploadedVideoId)}&t=${Date.now()}`, { cache: "no-store" });
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.playable === true) break;
            if (statusData.playable === false && statusData.encodingFailed === true) {
              toast("O api.video não conseguiu processar este arquivo. Tente outro vídeo MP4.");
              break;
            }
          }
        } catch (_) {}
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

    // Remove os cards antigos do api.video para recriá-los com o estado mais recente.
    apiVideoIds.forEach(id => feedEl?.querySelector(`.short-card[data-id="${CSS.escape(id)}"]`)?.remove());
    apiVideoIds.clear();
    await loadApiVideoFeed();
    toast("Feed atualizado. Toque no vídeo para testar a reprodução.");
  }

  function openPublishChoices() {
    const oldModal = $("#publish-modal");
    oldModal?.remove();
    const modal = document.createElement("div");
    modal.id = "publish-modal";
    modal.style.cssText = "position:absolute;inset:0;z-index:100;background:#000b;display:flex;align-items:center;justify-content:center;padding:22px;";
    modal.innerHTML = `
      <section style="width:100%;max-width:420px;background:#191b24;color:#fff;border:1px solid #ffffff24;border-radius:22px;padding:22px;font-family:inherit;">
        <h2 style="margin:0 0 8px;font-size:22px;">Criar Short</h2>
        <p style="margin:0 0 20px;color:#bfc2d0;font-size:14px;line-height:1.5;">Grave um vídeo de até 30 segundos ou escolha um da galeria.</p>
        <button id="publish-record" style="width:100%;padding:15px;border:0;border-radius:13px;background:linear-gradient(100deg,#ff315e,#8c5bff);color:white;font-weight:800;margin-bottom:10px;">🎥 Gravar vídeo (30 s)</button>
        <button id="publish-gallery" style="width:100%;padding:15px;border:1px solid #ffffff30;border-radius:13px;background:#ffffff0d;color:white;font-weight:750;margin-bottom:10px;">🖼️ Escolher da galeria</button>
        <button id="publish-cancel" style="width:100%;padding:12px;border:0;border-radius:12px;background:transparent;color:#c7c9d4;">Cancelar</button>
      </section>`;
    document.querySelector(".app-shell")?.appendChild(modal);
    $("#publish-cancel", modal).onclick = () => modal.remove();
    $("#publish-gallery", modal).onclick = () => {
      modal.remove();
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = "video/*";
      picker.onchange = async () => {
        const file = picker.files?.[0];
        if (!file) return;
        try { await uploadToApiVideo(file, file.name); }
        catch (error) { toast(error.message || "Falha no envio do vídeo."); }
      };
      picker.click();
    };
    $("#publish-record", modal).onclick = async () => {
      modal.remove();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        toast("A câmera não está disponível neste navegador. Escolha um vídeo da galeria.");
        openPublishChoices();
        return;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
        const recorderModal = document.createElement("div");
        recorderModal.id = "record-modal";
        recorderModal.style.cssText = "position:absolute;inset:0;z-index:101;background:#000e;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px;gap:14px;";
        recorderModal.innerHTML = `<video id="record-preview" autoplay muted playsinline style="width:100%;max-height:65%;object-fit:contain;background:#111;border-radius:16px;"></video><div id="record-count" style="font-size:20px;font-weight:800;color:white;">Gravação: 0/30 s</div><button id="record-stop" style="width:100%;max-width:420px;padding:15px;border:0;border-radius:13px;background:#ff315e;color:white;font-weight:800;">Parar e publicar</button><button id="record-cancel" style="width:100%;max-width:420px;padding:12px;border:1px solid #ffffff40;border-radius:13px;background:transparent;color:white;">Cancelar</button>`;
        document.querySelector(".app-shell")?.appendChild(recorderModal);
        $("#record-preview", recorderModal).srcObject = stream;
        const chunks = [];
        const recorder = new MediaRecorder(stream);
        let seconds = 0;
        let stopped = false;
        const timer = setInterval(() => {
          seconds++;
          $("#record-count", recorderModal).textContent = `Gravação: ${seconds}/30 s`;
          if (seconds >= 30 && recorder.state === "recording") recorder.stop();
        }, 1000);
        const cleanup = () => {
          clearInterval(timer);
          stream.getTracks().forEach(track => track.stop());
          recorderModal.remove();
        };
        recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          const file = new File([blob], `oio-shorts-${Date.now()}.webm`, { type: blob.type });
          cleanup();
          if (!stopped && file.size) {
            try { await uploadToApiVideo(file, file.name); }
            catch (error) { toast(error.message || "Falha no envio do vídeo."); }
          }
        };
        recorder.start(250);
        $("#record-stop", recorderModal).onclick = () => {
          stopped = false;
          if (recorder.state === "recording") recorder.stop();
        };
        $("#record-cancel", recorderModal).onclick = () => {
          stopped = true;
          if (recorder.state === "recording") recorder.stop();
        };
      } catch (error) {
        stream?.getTracks().forEach(track => track.stop());
        toast("Não foi possível abrir a câmera. Confira a permissão do navegador.");
      }
    };
  }

  $("#create-button").addEventListener("click", () => {
    if (location.hostname.endsWith("github.io")) {
      toast("Abra o OIO Shorts pelo endereço da Vercel para publicar vídeos.");
      return;
    }
    openPublishChoices();
  });

  loadApiVideoFeed();

  async function searchVimeoVideos(query) {
    const term = String(query || "").trim();
    if (!term) {
      toast("Digite um termo para buscar vídeos.");
      return;
    }
    toast("Montando feed misto Vimeo + Pexels + Pixabay + Vecteezy + Coverr…");
    try {
      const [vimeoResponse, pexelsResponse, pixabayResponse, vecteezyResponse, coverrResponse] = await Promise.all([
        fetch(`${API_BASE}/api/videos/vimeo?q=${encodeURIComponent(term)}&t=${Date.now()}`, {
          cache: "no-store", headers: { Accept: "application/json" }
        }),
        fetch(`${API_BASE}/api/videos/pexels?q=${encodeURIComponent(term)}&page=1&limit=20`, {
          headers: { Accept: "application/json" }
        }),
        fetch(`${API_BASE}/api/videos/pixabay?q=${encodeURIComponent(term)}&page=1&limit=20`, {
          headers: { Accept: "application/json" }
        }),
        fetch(`${API_BASE}/api/videos/vecteezy?q=${encodeURIComponent(term)}&page=1&limit=12`, {
          cache: "no-store", headers: { Accept: "application/json" }
        }),
        fetch(`${API_BASE}/api/videos/coverr?q=${encodeURIComponent(term)}&page=0&limit=100`, {
          cache: "no-store", headers: { Accept: "application/json" }
        })
      ]);
      const [vimeoPayload, pexelsPayload, pixabayPayload, vecteezyPayload, coverrPayload] = await Promise.all([
        vimeoResponse.json().catch(() => ({})),
        pexelsResponse.json().catch(() => ({})),
        pixabayResponse.json().catch(() => ({})),
        vecteezyResponse.json().catch(() => ({})),
        coverrResponse.json().catch(() => ({}))
      ]);
      if (!vimeoResponse.ok && !pexelsResponse.ok && !pixabayResponse.ok && !vecteezyResponse.ok && !coverrResponse.ok) {
        throw new Error(vimeoPayload.error || pexelsPayload.error || pixabayPayload.error || vecteezyPayload.error || coverrPayload.error || "Nenhuma fonte de vídeo respondeu.");
      }
      const sources = [
        { name: "Vimeo", videos: vimeoResponse.ok ? (vimeoPayload.videos || []) : [] },
        { name: "Pexels", videos: pexelsResponse.ok ? (pexelsPayload.videos || []) : [] },
        { name: "Pixabay", videos: pixabayResponse.ok ? (pixabayPayload.videos || []) : [] },
        { name: "Vecteezy", videos: vecteezyResponse.ok ? (vecteezyPayload.videos || []) : [] },
        { name: "Coverr", videos: coverrResponse.ok ? (coverrPayload.videos || []) : [] }
      ];
      if (!sources.some(source => source.videos.length)) {
        toast("Nenhum vídeo encontrado nas fontes disponíveis.");
        return;
      }

      const feed = $("#video-feed");
      if (!feed) throw new Error("O contêiner do feed não foi encontrado.");
      showScreen("feed-screen");

      const mixed = [];
      const max = Math.max(...sources.map(source => source.videos.length));
      for (let i = 0; i < max; i++) {
        sources.forEach(source => {
          if (source.videos[i]) mixed.push({ ...source.videos[i], source: source.name });
        });
      }

      const existing = new Set($$(".short-card[data-source-id]").map(card => card.dataset.sourceId));
      const fragment = document.createDocumentFragment();
      let added = 0;
      mixed.forEach(video => {
        const id = String(video.id || "");
        const source = video.source || "Vimeo";
        const sourceId = source + ":" + id;
        if (!id || existing.has(sourceId)) return;

        const card = document.createElement("article");
        card.className = "short-card";
        card.dataset.sourceId = sourceId;

        if (source === "Vimeo" && video.embedUrl) {
          const player = document.createElement("iframe");
          player.title = video.title || "Vídeo do Vimeo";
          player.src = video.embedUrl;
          player.allow = "autoplay; fullscreen; picture-in-picture";
          player.setAttribute("allowfullscreen", "");
          player.loading = "lazy";
          player.referrerPolicy = "strict-origin-when-cross-origin";
          player.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;z-index:1;";
          card.appendChild(player);
        } else if (video.videoUrl) {
          const player = document.createElement("video");
          player.className = "video-poster";
          player.src = video.videoUrl;
          player.poster = video.thumbnailUrl || "";
          player.controls = true;
          player.playsInline = true;
          player.preload = "metadata";
          player.setAttribute("aria-label", video.title || `Vídeo do ${source}`);
          if (source === "Vecteezy") {
            player.style.objectFit = "contain";
            player.style.background = "#000";
            player.addEventListener("loadedmetadata", () => {
              const vertical = player.videoHeight > player.videoWidth;
              player.style.objectFit = vertical ? "cover" : "contain";
              card.dataset.playback = "confirmed";
              player.dataset.playback = "confirmed";
            }, { once: true });
            player.addEventListener("error", () => {
              card.dataset.playback = "failed";
              player.dataset.playback = "failed";
              toast("Este preview do Vecteezy não pôde ser reproduzido neste navegador.");
            }, { once: true });
          }
          card.appendChild(player);
        } else {
          return;
        }

        const shade = document.createElement("div");
        shade.className = "video-shade";
        const top = document.createElement("div");
        top.className = "video-topline";
        top.innerHTML = '<span class="live-pill"><span></span> OIO SHORTS</span>';
        const sourceLabel = document.createElement("span");
        sourceLabel.className = "demo-label";
        sourceLabel.textContent = source.toUpperCase();
        top.appendChild(sourceLabel);

        const info = document.createElement("div");
        info.className = "video-info";
        const title = document.createElement("h2");
        title.textContent = video.title || "Vídeo";
        const description = document.createElement("p");
        description.textContent = video.description || (source === "Vimeo"
          ? "Vídeo encontrado no Vimeo."
          : `Vídeo do ${source} · ${video.creator || "Criador"}`);
        info.append(title, description);
        card.append(shade, top, info);

        if ((source === "Pexels" || source === "Pixabay" || source === "Vecteezy" || source === "Coverr") && video.pageUrl) {
          const credit = document.createElement("a");
          credit.href = video.pageUrl;
          credit.target = "_blank";
          credit.rel = "noopener noreferrer";
          credit.textContent = `Ver no ${source} ↗`;
          credit.style.cssText = "position:absolute;z-index:4;right:14px;bottom:14px;color:#fff;font-size:11px;text-decoration:underline;";
          card.appendChild(credit);
        }
        fragment.appendChild(card);
        existing.add(sourceId);
        added++;
      });

      if (added) {
        feed.querySelectorAll(".short-card[data-id^='demo-']").forEach(card => card.remove());
        feed.prepend(fragment);
        feed.scrollTo({ top: 0, behavior: "auto" });
      }
      const totals = sources.map(source => `${source.name}: ${source.videos.length}`).join(" · ");
      toast(`${added} vídeos adicionados · ${totals}`);
    } catch (error) {
      toast(error.message || "Falha ao montar o feed misto.");
    }
  }

  const searchPanel = $("#search-form");
  $("#search-toggle").addEventListener("click", () => {
    searchPanel.classList.toggle("hidden");
    if (!searchPanel.classList.contains("hidden")) $("#search-input").focus();
  });
  $("#search-close").addEventListener("click", () => searchPanel.classList.add("hidden"));
  searchPanel.addEventListener("submit", event => {
    event.preventDefault();
    const query = $("#search-input").value.trim();
    if (!query) return;
    $("#discover-query").value = query;
    searchPanel.classList.add("hidden");
    searchVimeoVideos(query);
  });
  $(".category-tile[data-query]").forEach(tile => tile.addEventListener("click", () => {
    $("#discover-query").value = tile.dataset.query;
    toast("Categoria selecionada: " + tile.dataset.query);
  }));
  $("#discover-search-button").addEventListener("click", () => {
    const query = $("#discover-query").value.trim();
    searchVimeoVideos(query);
  });

  // Carrega vídeos do Vimeo automaticamente no feed inicial.
  searchVimeoVideos("nature");

  $("#diagnose-button").addEventListener("click", () => {
    const pinId = $("#pin-id").value.trim();
    const result = $("#diagnostic-result");
    result.classList.remove("hidden");
    if (!pinId) {
      result.textContent = "Digite o ID de um Pin de vídeo. Nenhuma chamada à API foi feita.";
      return;
    }
    if (!/^[0-9]{5,30}$/.test(pinId)) {
      result.textContent = "Confira o ID: use apenas números (de 5 a 30 dígitos). Nenhuma chamada à API foi feita.";
      return;
    }
    result.textContent = "ID registrado para o teste: " + pinId + ". Esta versão ainda não chama a API do Pinterest; primeiro vamos configurar o fluxo seguro do GitHub Actions.";
    toast("ID validado localmente; API ainda não consultada.");
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();