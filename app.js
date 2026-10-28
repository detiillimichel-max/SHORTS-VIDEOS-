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
  $("#create-button").addEventListener("click", () => toast("Publicação de vídeos será adicionada numa próxima etapa."));

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