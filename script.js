
      // Troque pelas suas chaves do Supabase.
      // É correto usar a anon/public key no frontend; a segurança real fica nas RLS policies do banco.
      const SUPABASE_URL = "https://yfcjqbconizpfxatapbl.supabase.co";
      const SUPABASE_ANON_KEY =
        "sb_publishable_NwHHZTjaqP5qyRkL2vyhDg_NFepgwMA";

      const supabaseClient = supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      );

      const state = {
        session: null,
        books: [],
        filteredBooks: [],
        visibleCount: 24,
        pageSize: 24,
        viewMode: "gallery",
      };

      const el = (id) => document.getElementById(id);
      const money = (value) =>
        Number(value || 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      const escapeHtml = (value = "") =>
        String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");

      function toast(message) {
        const toastEl = el("toast");
        toastEl.textContent = message;
        toastEl.classList.remove("hidden");
        setTimeout(() => toastEl.classList.add("hidden"), 2800);
      }

      function openModal(id) {
        el(id).classList.remove("hidden");
        el(id).classList.add("flex");
      }

      function closeModal(id) {
        el(id).classList.add("hidden");
        el(id).classList.remove("flex");
      }

      function generateId() {
        return (
          Math.random().toString(36).slice(2, 12) +
          Date.now().toString(36).slice(-6)
        );
      }

      function withTimeout(promise, ms = 10000) {
        return Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error("Tempo esgotado ao conectar com o Supabase.")),
              ms,
            ),
          ),
        ]);
      }

      async function init() {
        // Os cliques precisam ser registrados antes de qualquer chamada externa.
        // Antes, se o Supabase demorasse/falhasse, o botão Entrar e os modais nunca eram ativados.
        bindEvents();
        updateAuthUI();

        if (
          SUPABASE_URL.includes("COLE_AQUI") ||
          SUPABASE_ANON_KEY.includes("COLE_AQUI")
        ) {
          el("loadingState").classList.add("hidden");
          el("emptyState").classList.remove("hidden");
          toast("Configure SUPABASE_URL e SUPABASE_ANON_KEY no index.html");
          return;
        }

        try {
          const { data } = await withTimeout(
            supabaseClient.auth.getSession(),
            10000,
          );
          state.session = data?.session || null;
          updateAuthUI();
        } catch (error) {
          console.error(error);
          state.session = null;
          updateAuthUI();
          toast(
            "Não consegui validar a sessão agora. Você ainda pode tentar entrar.",
          );
        }

        await loadBooks();

        supabaseClient.auth.onAuthStateChange(async (_event, session) => {
          state.session = session;
          updateAuthUI();
          await loadBooks();
        });
      }

      function bindEvents() {
        el("openAuthBtn").addEventListener("click", () =>
          openModal("authModal"),
        );
        el("logoutBtn").addEventListener("click", logout);
        el("openBookBtn").addEventListener("click", () => openBookModal());
        el("openImportBtn").addEventListener("click", () =>
          openModal("importModal"),
        );
        el("searchInput").addEventListener("input", applyFilters);
        el("readFilter").addEventListener("change", applyFilters);
        el("sortFilter").addEventListener("change", applyFilters);
        el("galleryViewBtn").addEventListener("click", () => setViewMode("gallery"));
        el("listViewBtn").addEventListener("click", () => setViewMode("list"));
        el("loadMoreBtn").addEventListener("click", loadMoreBooks);
        el("authForm").addEventListener("submit", authSubmit);
        el("bookForm").addEventListener("submit", saveBook);
        el("fetchIsbnBtn").addEventListener("click", fetchBookByIsbn);
        el("importBtn").addEventListener("click", importJson);

        document.querySelectorAll("[data-close]").forEach((button) => {
          button.addEventListener("click", () =>
            closeModal(button.dataset.close),
          );
        });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            ["authModal", "bookModal", "importModal"].forEach(closeModal);
          }
        });
      }

      function updateAuthUI() {
        const logged = Boolean(state.session?.user);
        el("openAuthBtn").classList.toggle("hidden", logged);
        el("logoutBtn").classList.toggle("hidden", !logged);
        el("adminActions").classList.toggle("hidden", !logged);

        const sessionEmail = el("sessionEmail");
        if (sessionEmail) {
          sessionEmail.classList.toggle("hidden", !logged);
          sessionEmail.textContent = logged ? state.session.user.email : "";
        }

        el("authHint").textContent = logged
          ? "Você está logado. Agora pode criar, editar, apagar e importar livros."
          : "Visitantes podem ver a biblioteca. Para criar, editar, apagar ou importar livros, faça login.";
      }

      async function authSubmit(event) {
        event.preventDefault();
        const submitter = event.submitter;
        const mode = submitter.dataset.mode;
        const email = el("authEmail").value.trim();
        const password = el("authPassword").value;
        const message = el("authMessage");
        message.className = "mt-4 hidden rounded-2xl px-4 py-3 text-sm";

        submitter.disabled = true;
        submitter.textContent = mode === "login" ? "Entrando..." : "Criando...";

        const response =
          mode === "login"
            ? await supabaseClient.auth.signInWithPassword({ email, password })
            : await supabaseClient.auth.signUp({ email, password });

        submitter.disabled = false;
        submitter.textContent = mode === "login" ? "Entrar" : "Criar conta";

        if (response.error) {
          message.textContent = response.error.message;
          message.className =
            "mt-4 rounded-2xl bg-rose/10 px-4 py-3 text-sm text-wine";
          return;
        }

        message.textContent =
          mode === "login"
            ? "Login realizado com sucesso."
            : "Conta criada. Se a confirmação por e-mail estiver ativa, confirme antes de entrar.";
        message.className =
          "mt-4 rounded-2xl bg-moss/10 px-4 py-3 text-sm text-moss";

        if (mode === "login") {
          state.session = response.data?.session || (await supabaseClient.auth.getSession()).data?.session || null;
          updateAuthUI();
          closeModal("authModal");
          toast("Bem-vinda à biblioteca.");
          await loadBooks();
        }
      }

      async function logout() {
        await supabaseClient.auth.signOut();
        toast("Você saiu da biblioteca.");
      }

      async function loadBooks() {
        el("loadingState").classList.remove("hidden");
        el("emptyState").classList.add("hidden");
        el("booksGrid").innerHTML = "";

        try {
          let response = await withTimeout(
            supabaseClient
              .from("livros")
              .select(
                "id, preco, livro, editora, autor, lido, isbn_13, capa_url, nota, resenha_pessoal, frase_favorita, created_at",
              )
              .order("livro", { ascending: true }),
            12000,
          );

          // Compatibilidade com a primeira tabela, caso você ainda não tenha rodado a migration
          // que adiciona isbn_13 e capa_url.
          if (
            response.error &&
            ["isbn_13", "capa_url", "nota", "resenha_pessoal", "frase_favorita", "created_at"].some((column) => String(response.error.message || "").includes(column))
          ) {
            response = await withTimeout(
              supabaseClient
                .from("livros")
                .select("id, preco, livro, editora, autor, lido")
                .order("livro", { ascending: true }),
              12000,
            );
          }

          if (response.error) throw response.error;

          state.books = (response.data || []).map((book) => ({
            ...book,
            isbn_13: book.isbn_13 || "",
            capa_url: book.capa_url || "",
            nota: book.nota ?? null,
            resenha_pessoal: book.resenha_pessoal || "",
            frase_favorita: book.frase_favorita || "",
            created_at: book.created_at || "",
          }));
          applyFilters();
        } catch (error) {
          console.error(error);
          state.books = [];
          state.filteredBooks = [];
          renderStats();
          el("emptyState").classList.remove("hidden");
          toast(error?.message || "Não foi possível carregar a estante.");
        } finally {
          el("loadingState").classList.add("hidden");
        }
      }

      function applyFilters(resetVisible = true) {
        if (resetVisible) state.visibleCount = state.pageSize;
        const search = el("searchInput").value.trim().toLowerCase();
        const readFilter = el("readFilter").value;
        const sort = el("sortFilter").value;

        let books = [...state.books];

        if (search) {
          books = books.filter((book) =>
            [book.livro, book.autor, book.editora].some((field) =>
              String(field || "")
                .toLowerCase()
                .includes(search),
            ),
          );
        }

        if (readFilter === "read") books = books.filter((book) => book.lido);
        if (readFilter === "unread") books = books.filter((book) => !book.lido);

        const sorters = {
          "livro-asc": (a, b) => String(a.livro).localeCompare(String(b.livro)),
          "livro-desc": (a, b) =>
            String(b.livro).localeCompare(String(a.livro)),
          "preco-desc": (a, b) => Number(b.preco || 0) - Number(a.preco || 0),
          "preco-asc": (a, b) => Number(a.preco || 0) - Number(b.preco || 0),
          "autor-asc": (a, b) =>
            String(a.autor || "").localeCompare(String(b.autor || "")),
          "editora-asc": (a, b) =>
            String(a.editora || "").localeCompare(String(b.editora || "")),
          "lidos-first": (a, b) => Number(Boolean(b.lido)) - Number(Boolean(a.lido)),
          "nao-lidos-first": (a, b) => Number(Boolean(a.lido)) - Number(Boolean(b.lido)),
          "nota-desc": (a, b) => Number(b.nota || 0) - Number(a.nota || 0),
          "recentes": (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")),
        };

        books.sort(sorters[sort] || sorters["livro-asc"]);
        state.filteredBooks = books;
        renderStats();
        renderBooks();
      }

      function getMostFrequent(items) {
        const counts = items
          .filter(Boolean)
          .reduce((acc, item) => {
            const key = String(item).trim();
            if (!key) return acc;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});

        const [name] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ["-"];
        return name;
      }

      function renderStats() {
        const total = state.books.length;
        const read = state.books.filter((book) => book.lido).length;
        const unread = total - read;
        const value = state.books.reduce(
          (sum, book) => sum + Number(book.preco || 0),
          0,
        );
        const ratedBooks = state.books.filter((book) => Number(book.nota || 0) > 0);
        const ratingAverage = ratedBooks.length
          ? ratedBooks.reduce((sum, book) => sum + Number(book.nota || 0), 0) / ratedBooks.length
          : 0;
        const readPercent = total ? Math.round((read / total) * 100) : 0;

        el("totalBooks").textContent = total;
        el("readBooks").textContent = read;
        el("totalValue").textContent = money(value);
        el("unreadBooks").textContent = unread;
        el("averagePrice").textContent = total ? money(value / total).replace(",00", "") : "R$0";
        el("averageRating").textContent = ratedBooks.length ? `${ratingAverage.toFixed(1)} ★` : "-";
        el("topPublisher").textContent = getMostFrequent(state.books.map((book) => book.editora));
        el("topAuthor").textContent = getMostFrequent(state.books.map((book) => book.autor));
        el("readPercentText").textContent = `${readPercent}% lido`;
      }

      function setViewMode(mode) {
        state.viewMode = mode;
        el("galleryViewBtn").classList.toggle("active", mode === "gallery");
        el("listViewBtn").classList.toggle("active", mode === "list");
        renderBooks();
      }

      function loadMoreBooks() {
        state.visibleCount += state.pageSize;
        renderBooks();
      }

      function renderStars(value) {
        const rating = Number(value || 0);
        if (!rating) return "";
        return `<span class="rounded-full bg-wine/10 px-3 py-1 text-xs font-bold text-wine">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span>`;
      }

      function renderBooks() {
        const grid = el("booksGrid");
        const logged = Boolean(state.session?.user);
        grid.innerHTML = "";
        grid.classList.toggle("books-list", state.viewMode === "list");

        el("emptyState").classList.toggle(
          "hidden",
          state.filteredBooks.length > 0,
        );

        const visibleBooks = state.filteredBooks.slice(0, state.visibleCount);
        el("loadMoreBtn").classList.toggle("hidden", state.filteredBooks.length <= state.visibleCount);
        el("loadMoreBtn").textContent = `Carregar mais livros (${Math.min(state.visibleCount, state.filteredBooks.length)} de ${state.filteredBooks.length})`;

        visibleBooks.forEach((book, index) => {
          const mood = book.lido ? "Lido" : "Na pilha de leitura";
          const quote = book.lido
            ? "Uma história já guardada na memória."
            : "Ainda esperando sua noite de chá.";
          const initials = String(book.livro || "?")
            .trim()
            .slice(0, 1)
            .toUpperCase();
          const cover = book.capa_url
            ? `
    <img
      src="${escapeHtml(book.capa_url)}"
      alt="Capa de ${escapeHtml(book.livro)}"
      class="book-cover h-32 w-22 shrink-0 rounded-tl-xl rounded-tr-sm rounded-bl-sm rounded-br-xl border border-wine/15 bg-parchment object-cover shadow-xl shadow-wine/10"
      data-initials="${escapeHtml(initials)}"
    />
  `
            : fallbackCoverHtml(initials);

          const card = document.createElement("article");
          card.className =
            "book-card group relative overflow-hidden rounded-[1.75rem] border border-wine/10 bg-white/50 p-5 transition duration-300";
          card.innerHTML = `
          <div class="absolute right-0 top-0 h-24 w-24 rounded-bl-[4rem] ${index % 2 === 0 ? "bg-wine/10" : "bg-moss/10"}"></div>
          <div class="book-card-body relative flex gap-4">
            ${cover}
            <div class="min-w-0 flex-1">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <span class="rounded-full ${book.lido ? "bg-moss/10 text-moss" : "bg-rose/10 text-wine"} px-3 py-1 text-xs font-bold">${mood}</span>
                <span class="rounded-full bg-tea/10 px-3 py-1 text-xs font-bold text-tea">${money(book.preco)}</span>
                ${renderStars(book.nota)}
              </div>
              <h3 class="line-clamp-2 font-serif text-3xl font-bold leading-8 text-ink">${escapeHtml(book.livro)}</h3>
              <p class="mt-2 text-sm font-semibold text-wine/80">${escapeHtml(book.autor || "Autor não informado")}</p>
              <p class="mt-1 text-sm text-ink/55">${escapeHtml(book.editora || "Editora não informada")}</p>
              ${book.isbn_13 ? `<p class="mt-2 text-xs text-ink/40">ISBN-13: ${escapeHtml(book.isbn_13)}</p>` : ""}
            </div>
          </div>
          <div class="book-quote relative mt-5 rounded-2xl border border-wine/10 bg-parchment/70 p-4">
            <p class="font-serif text-lg italic text-ink/70">“${escapeHtml(book.frase_favorita || quote)}”</p>
            ${book.resenha_pessoal ? `<p class="mt-3 line-clamp-2 text-sm leading-6 text-ink/60">${escapeHtml(book.resenha_pessoal)}</p>` : ""}
          </div>
          <div class="relative mt-4 ${logged ? "flex" : "hidden"} justify-end gap-2">
            <button class="edit-book rounded-xl border border-wine/20 bg-white/50 px-3 py-2 text-xs font-bold text-wine hover:bg-white">Editar</button>
            <button class="delete-book rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white hover:bg-wine">Apagar</button>
          </div>
        `;
          card.querySelectorAll(".book-cover").forEach((img) => {
            img.addEventListener("error", () => {
              img.replaceWith(createFallbackCover(img.dataset.initials || "?"));
            });
          });
          card
            .querySelector(".edit-book")
            ?.addEventListener("click", () => openBookModal(book));
          card
            .querySelector(".delete-book")
            ?.addEventListener("click", () => deleteBook(book.id));
          grid.appendChild(card);
        });
      }
      function createFallbackCover(initials) {
        const div = document.createElement("div");

        div.className =
          "grid h-32 w-22 shrink-0 place-items-center rounded-tl-xl rounded-tr-sm rounded-bl-sm rounded-br-xl border border-wine/15 bg-gradient-to-br from-wine/90 to-ink text-parchment shadow-xl shadow-wine/10";

        const span = document.createElement("span");
        span.className = "font-serif text-5xl font-bold";
        span.textContent = initials || "?";

        div.appendChild(span);

        return div;
      }
      function fallbackCoverHtml(initials) {
        return `<div class="grid h-32 w-22 shrink-0 place-items-center rounded-tl-xl rounded-tr-sm rounded-bl-sm rounded-br-xl border border-wine/15 bg-gradient-to-br from-wine/90 to-ink text-parchment shadow-xl shadow-wine/10"><span class="font-serif text-5xl font-bold">${escapeHtml(initials)}</span></div>`;
      }

      function openBookModal(book = null) {
        el("bookForm").reset();
        el("bookOriginalId").value = book?.id || "";
        el("bookModalTitle").textContent = book ? "Editar livro" : "Novo livro";
        el("bookIsbn").value = book?.isbn_13 || "";
        el("bookPrice").value = book?.preco ?? "";
        el("bookName").value = book?.livro || "";
        el("bookPublisher").value = book?.editora || "";
        el("bookAuthor").value = book?.autor || "";
        el("bookCover").value = book?.capa_url || "";
        el("bookRead").checked = Boolean(book?.lido);
        el("bookRating").value = book?.nota || "";
        el("bookFavoriteQuote").value = book?.frase_favorita || "";
        el("bookReview").value = book?.resenha_pessoal || "";
        openModal("bookModal");
      }

      function normalizeIsbn(value = "") {
        return String(value)
          .replace(/[^0-9Xx]/g, "")
          .trim();
      }

      function collectBookPayload() {
        return {
          preco: Number(el("bookPrice").value || 0),
          livro: el("bookName").value.trim(),
          editora: el("bookPublisher").value.trim() || null,
          autor: el("bookAuthor").value.trim() || null,
          lido: el("bookRead").checked,
          isbn_13: normalizeIsbn(el("bookIsbn").value) || null,
          capa_url: el("bookCover").value.trim() || null,
          nota: el("bookRating").value ? Number(el("bookRating").value) : null,
          frase_favorita: el("bookFavoriteQuote").value.trim() || null,
          resenha_pessoal: el("bookReview").value.trim() || null,
        };
      }

      async function saveBook(event) {
        event.preventDefault();
        if (!state.session?.user)
          return toast("Faça login para salvar livros.");

        const payload = collectBookPayload();
        const originalId = el("bookOriginalId").value;
        const response = originalId
          ? await supabaseClient
              .from("livros")
              .update(payload)
              .eq("id", originalId)
          : await supabaseClient.from("livros").insert(payload);

        if (response.error) return toast(response.error.message);

        closeModal("bookModal");
        toast("Livro salvo com elegância.");
        await loadBooks();
      }

      async function deleteBook(id) {
        if (!state.session?.user)
          return toast("Faça login para apagar livros.");
        const confirmed = confirm("Deseja apagar este livro da biblioteca?");
        if (!confirmed) return;

        const { error } = await supabaseClient
          .from("livros")
          .delete()
          .eq("id", id);
        if (error) return toast(error.message);

        toast("Livro removido da estante.");
        await loadBooks();
      }

      function normalizeImportedBook(item) {
        return {
          preco: Number(item.preco || 0),
          livro: String(item.livro || "").trim(),
          editora: item.editora ? String(item.editora).trim() : null,
          autor: item.autor ? String(item.autor).trim() : null,
          lido: Boolean(item.lido),
          isbn_13: item.isbn_13 ? normalizeIsbn(item.isbn_13) : null,
          capa_url: item.capa_url ? String(item.capa_url).trim() : null,
          nota: item.nota ? Number(item.nota) : null,
          frase_favorita: item.frase_favorita ? String(item.frase_favorita).trim() : null,
          resenha_pessoal: item.resenha_pessoal ? String(item.resenha_pessoal).trim() : null,
        };
      }

      async function importJson() {
        if (!state.session?.user)
          return toast("Faça login para importar livros.");
        const message = el("importMessage");
        message.textContent = "";

        try {
          const parsed = JSON.parse(el("jsonInput").value);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const payload = list
            .map(normalizeImportedBook)
            .filter((item) => item.livro);

          if (!payload.length) {
            message.textContent = "Nenhum livro válido encontrado no JSON.";
            return;
          }

          const { error } = await supabaseClient.from("livros").insert(payload);
          if (error) {
            message.textContent = error.message;
            return;
          }

          message.textContent = `${payload.length} livro(s) importado(s).`;
          toast("Importação concluída.");
          await loadBooks();
        } catch (error) {
          message.textContent =
            "JSON inválido. Confira vírgulas, aspas e colchetes.";
        }
      }

      async function fetchBookByIsbn() {
        const isbn = normalizeIsbn(el("bookIsbn").value);
        if (!isbn) return toast("Informe um ISBN para buscar.");

        const button = el("fetchIsbnBtn");
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Buscando...";

        try {
          let found = null;

          const googleResponse = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
          );
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            const info = googleData?.items?.[0]?.volumeInfo;
            if (info) {
              found = {
                livro: info.title || "",
                autor: Array.isArray(info.authors)
                  ? info.authors.join(", ")
                  : "",
                editora: info.publisher || "",
                capa_url: (
                  info.imageLinks?.thumbnail ||
                  info.imageLinks?.smallThumbnail ||
                  ""
                ).replace("http://", "https://"),
              };
            }
          }

          if (!found) {
            const openLibraryResponse = await fetch(
              `https://openlibrary.org/isbn/${isbn}.json`,
            );
            if (openLibraryResponse.ok) {
              const data = await openLibraryResponse.json();
              found = {
                livro: data.title || "",
                autor: "",
                editora: Array.isArray(data.publishers)
                  ? data.publishers.join(", ")
                  : "",
                capa_url: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
              };
            }
          }

          if (!found || !found.livro) {
            toast("Não encontrei esse ISBN. Você pode preencher manualmente.");
            return;
          }

          if (found.livro) el("bookName").value = found.livro;
          if (found.autor) el("bookAuthor").value = found.autor;
          if (found.editora) el("bookPublisher").value = found.editora;
          if (found.capa_url) el("bookCover").value = found.capa_url;
          toast("Dados encontrados pelo ISBN. Confira antes de salvar.");
        } catch (error) {
          toast("Falha ao buscar pelo ISBN. Preencha manualmente.");
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      }

      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("sw.js").catch(() => {});
        });
      }

      document.addEventListener("DOMContentLoaded", init);
    