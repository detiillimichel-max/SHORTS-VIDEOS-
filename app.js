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
    showScreen("discover-screen");
    searchPanel.classList.add("hidden");
    toast("Busca preparada. A pesquisa na API será conectada depois.");
  });
  $$(".category-tile").forEach(tile => tile.addEventListener("click", () => {
    $("#discover-query").value = tile.dataset.query;
    toast("Categoria selecionada: " + tile.dataset.query);
  }));
  $("#discover-search-button").addEventListener("click", () => {
    const query = $("#discover-query").value.trim();
    toast(query ? "Pesquisa preparada: " + query : "Digite um termo ou ID de Pin.");
  });

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