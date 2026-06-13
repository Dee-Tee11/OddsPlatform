/**
 * OddsDash - Odds Panel Module
 * Handles the display and filtering of betting odds
 */

// ─────────────────────────────────────────────────────
// Panel Initialization
// ─────────────────────────────────────────────────────
function initOddsPanel() {
  const panel = document.getElementById("panel-odds");
  if (panel.innerHTML) return; // Already initialized

  panel.innerHTML = `
    <!-- View toggle + league filter -->
    <div class="top-row">
      <div class="toggle-group">
        <button class="toggle-opt active" data-view="best-odds">★ Melhores odds</button>
        <button class="toggle-opt" data-view="all-bookmakers">Todos</button>
      </div>
      <div style="margin-left:auto; display:flex; gap:8px; align-items:center">
        <label class="muted-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="show-elo" style="accent-color:var(--purple)"> Análise ELO
        </label>
        <label class="muted-label" style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="value-only" style="accent-color:var(--green)"> Só valor
        </label>
      </div>
    </div>

    <!-- League tabs -->
    <div class="tab-section">
      <div class="tab-label">Competições</div>
      <div class="tabs" id="league-tabs"></div>
    </div>

    <!-- Bookmaker tabs -->
    <div class="tab-section" id="bm-section" style="display:none">
      <div class="tab-label">Casas de Apostas</div>
      <div class="tabs" id="bm-tabs"></div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card" style="border-color:#1a3a6b">
        <div class="stat-label">Jogos</div>
        <div class="stat-val" id="stat-games" style="color:var(--blue)">—</div>
      </div>
      <div class="stat-card" style="border-color:var(--green-dim)">
        <div class="stat-label">Melhor casa</div>
        <div class="stat-val" id="stat-home" style="color:var(--green)">—</div>
      </div>
      <div class="stat-card" style="border-color:var(--border)">
        <div class="stat-label">Melhor empate</div>
        <div class="stat-val" id="stat-draw" style="color:var(--muted)">—</div>
      </div>
      <div class="stat-card" style="border-color:#6b4000">
        <div class="stat-label">Melhor fora</div>
        <div class="stat-val" id="stat-away" style="color:var(--amber)">—</div>
      </div>
      <div class="stat-card" style="border-color:#4a2e8a">
        <div class="stat-label">Apostas valor</div>
        <div class="stat-val" id="stat-value" style="color:var(--purple)">—</div>
      </div>
    </div>

    <!-- Filter bar -->
    <div id="filter-bar">
      <div class="filter-row">
        <input id="search-input" type="text" placeholder="🔍 Pesquisar equipa ou liga..." />
        <span class="muted-label">Ordenar:</span>
        <button class="sort-btn active" data-sort="date">Data ↑</button>
        <button class="sort-btn" data-sort="game">Jogo</button>
        <button class="sort-btn" data-sort="home">1 Casa</button>
        <button class="sort-btn" data-sort="draw">X Empate</button>
        <button class="sort-btn" data-sort="away">2 Fora</button>
      </div>
      <div class="filter-row">
        <span class="muted-label">Odds entre:</span>
        <input class="num-input" id="min-odd" type="number" placeholder="Mín" step="0.1" min="1" />
        <span class="muted-label">e</span>
        <input class="num-input" id="max-odd" type="number" placeholder="Máx" step="0.1" min="1" />
        <select id="odd-focus">
          <option value="all">Qualquer odd</option>
          <option value="home">Só casa (1)</option>
          <option value="draw">Só empate (X)</option>
          <option value="away">Só fora (2)</option>
        </select>
        <button id="clear-btn" class="btn btn-danger" style="display:none;margin-left:auto">✕ Limpar</button>
      </div>
    </div>

    <!-- Content -->
    <div id="content"></div>
    <div class="footer-line" id="footer-line"></div>
  `;

  // Setup event listeners
  setupOddsEvents();
  renderLeagueTabs();
  renderOddsContent();
}

// ─────────────────────────────────────────────────────
// Event Setup
// ─────────────────────────────────────────────────────
function setupOddsEvents() {
  // View toggle
  document.querySelectorAll(".toggle-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      AppState.viewMode = btn.dataset.view;
      document.querySelectorAll(".toggle-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderOddsContent();
    });
  });

  // Sort buttons
  document.querySelectorAll(".sort-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.sort;
      if (AppState.sortField === f) {
        AppState.sortDir = AppState.sortDir === "asc" ? "desc" : "asc";
      } else {
        AppState.sortField = f;
        AppState.sortDir = f === "date" ? "asc" : "desc";
      }
      renderSortBtns();
      renderClearBtn();
      renderOddsContent();
    });
  });

  // Search
  document.getElementById("search-input").addEventListener("input", e => {
    AppState.search = e.target.value;
    renderClearBtn();
    renderOddsContent();
  });

  // Odd filters
  ["min-odd", "max-odd"].forEach(id => {
    document.getElementById(id).addEventListener("input", e => {
      if (id === "min-odd") AppState.minOdd = e.target.value;
      else AppState.maxOdd = e.target.value;
      renderClearBtn();
      renderOddsContent();
    });
  });

  document.getElementById("odd-focus").addEventListener("change", e => {
    AppState.oddFocus = e.target.value;
    renderOddsContent();
  });

  // ELO toggle
  document.getElementById("show-elo").addEventListener("change", e => {
    AppState.showElo = e.target.checked;
    document.getElementById("value-only").disabled = !AppState.showElo;
    renderOddsContent();
  });

  document.getElementById("value-only").addEventListener("change", e => {
    AppState.valueOnly = e.target.checked;
    renderOddsContent();
  });

  // Clear
  document.getElementById("clear-btn").addEventListener("click", () => {
    AppState.search = "";
    AppState.minOdd = "";
    AppState.maxOdd = "";
    AppState.sortField = "date";
    AppState.sortDir = "asc";
    AppState.oddFocus = "all";
    document.getElementById("search-input").value = "";
    document.getElementById("min-odd").value = "";
    document.getElementById("max-odd").value = "";
    document.getElementById("odd-focus").value = "all";
    renderSortBtns();
    renderClearBtn();
    renderOddsContent();
  });
}

// ─────────────────────────────────────────────────────
// League & Bookmaker Tabs
// ─────────────────────────────────────────────────────
function renderLeagueTabs() {
  const tabs = document.getElementById("league-tabs");
  tabs.innerHTML = `<button class="tab${AppState.selectedLeague === "top" ? " active" : ""}" data-key="top">🏆 Top Ligas</button>`;
  tabs.innerHTML += `<button class="tab${AppState.selectedLeague === "all" ? " active" : ""}" data-key="all">⚽ Todas</button>`;
  Object.entries(LEAGUES).forEach(([k, v]) => {
    tabs.innerHTML += `<button class="tab${AppState.selectedLeague === k ? " active" : ""}" data-key="${k}">${v.flag} ${v.name}</button>`;
  });

  tabs.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      AppState.selectedLeague = btn.dataset.key;
      renderLeagueTabs();
      renderBmTabs();
      fetchOdds();
    });
  });
}

function renderBmTabs() {
  const sec = document.getElementById("bm-section");
  const tabs = document.getElementById("bm-tabs");
  if (!AppState.bookmakers.length) {
    sec.style.display = "none";
    return;
  }
  sec.style.display = "";
  tabs.innerHTML = `<button class="tab${AppState.selectedBook === "all" ? " active" : ""}" data-key="all">✓ Todas</button>`;
  AppState.bookmakers.forEach(b => {
    tabs.innerHTML += `<button class="tab${AppState.selectedBook === b.key ? " active" : ""}" data-key="${b.key}">${b.name}</button>`;
  });

  tabs.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      AppState.selectedBook = btn.dataset.key;
      renderBmTabs();
      fetchOdds();
    });
  });
}

// ─────────────────────────────────────────────────────
// Filtering & Rendering
// ─────────────────────────────────────────────────────
function filteredGames() {
  let list = AppState.games;

  // Filter by bookmaker
  if (AppState.selectedBook !== "all") {
    list = list
      .map(g => ({
        ...g,
        bookmakers: g.bookmakers.filter(b => b.key === AppState.selectedBook)
      }))
      .filter(g => g.bookmakers.length > 0);
  }

  // Best odds view
  if (AppState.viewMode === "best-odds") {
    list = list.map(g => {
      const bH = Math.max(...g.bookmakers.map(b => b.home));
      const bD = Math.max(...g.bookmakers.map(b => b.draw));
      const bA = Math.max(...g.bookmakers.map(b => b.away));
      const nmH = (g.bookmakers.find(b => b.home === bH) || {}).name || "—";
      const nmD = (g.bookmakers.find(b => b.draw === bD) || {}).name || "—";
      const nmA = (g.bookmakers.find(b => b.away === bA) || {}).name || "—";
      return {
        ...g,
        _best: true,
        _bookmakers_all: g.bookmakers,
        bookmakers: [
          {
            key: "best",
            name: `${nmH} / ${nmD} / ${nmA}`,
            home: bH,
            draw: bD,
            away: bA,
            last_update: null
          }
        ]
      };
    });
  }

  // Search filter
  const q = AppState.search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      g =>
        g.home_team.toLowerCase().includes(q) ||
        g.away_team.toLowerCase().includes(q) ||
        g.league_name.toLowerCase().includes(q)
    );
  }

  // Odds range filter
  const mn = parseFloat(AppState.minOdd),
    mx = parseFloat(AppState.maxOdd);
  if (!isNaN(mn) || !isNaN(mx)) {
    list = list
      .map(g => ({
        ...g,
        bookmakers: g.bookmakers.filter(bm => {
          const vals =
            AppState.oddFocus === "all"
              ? [bm.home, bm.draw, bm.away].filter(v => v > 0)
              : [bm[AppState.oddFocus]].filter(v => v > 0);
          if (!vals.length) return false;
          return vals.some(
            v =>
              (!isNaN(mn) ? v >= mn : true) && (!isNaN(mx) ? v <= mx : true)
          );
        })
      }))
      .filter(g => g.bookmakers.length > 0);
  }

  // Value only filter
  if (AppState.valueOnly && AppState.showElo) {
    list = list.filter(g => {
      if (!g.elo_probs) return false;
      const bm = g.bookmakers[0];
      const h = isValueBet(g.elo_probs.home, bm.home);
      const d = isValueBet(g.elo_probs.draw, bm.draw);
      const a = isValueBet(g.elo_probs.away, bm.away);
      return (h && h.value) || (d && d.value) || (a && a.value);
    });
  }

  // Sorting
  list = [...list].sort((a, b) => {
    let va, vb;
    if (AppState.sortField === "date") {
      va = new Date(a.commence_time).getTime();
      vb = new Date(b.commence_time).getTime();
    } else if (AppState.sortField === "game") {
      const sa = a.home_team + a.away_team,
        sb = b.home_team + b.away_team;
      return AppState.sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    } else {
      va = Math.max(...a.bookmakers.map(bm => bm[AppState.sortField]));
      vb = Math.max(...b.bookmakers.map(bm => bm[AppState.sortField]));
    }
    return AppState.sortDir === "asc" ? va - vb : vb - va;
  });

  return list;
}

function renderOddsContent() {
  const content = document.getElementById("content");
  const footer = document.getElementById("footer-line");

  console.log("🎨 renderOddsContent called. AppState.games:", AppState.games);

  if (AppState.loading && AppState.games.length === 0) {
    content.innerHTML = `<div class="state-msg"><span class="spinner"></span>A carregar odds…</div>`;
    footer.textContent = "";
    return;
  }

  const list = filteredGames();
  console.log("📋 Filtered games:", list);
  renderStats(list);

  if (!AppState.loading && list.length === 0) {
    content.innerHTML = `<div class="state-msg">Nenhum jogo encontrado. Experimenta ajustar os filtros.</div>`;
    footer.textContent = "";
    return;
  }

  const isBestView = AppState.viewMode === "best-odds";
  const bmHeader = isBestView ? "Melhor bookmaker (1/X/2)" : "Bookmaker";

  let rows = "";
  list.forEach(game => {
    const bestH = Math.max(...game.bookmakers.map(b => b.home));
    const bestD = Math.max(...game.bookmakers.map(b => b.draw));
    const bestA = Math.max(...game.bookmakers.map(b => b.away));
    const ep = game.elo_probs;
    const gameHist = AppState.historyCache[game.id] || {};
    const allBmsForGame = game._bookmakers_all || game.bookmakers;

    game.bookmakers.forEach((bm, idx) => {
      const safeHome = game.home_team.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const safeAway = game.away_team.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const safeBmName = bm.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const gameId = game.id;

      rows += `<tr style="cursor:pointer;transition:background .1s">`;

      if (idx === 0) {
        const rs = game.bookmakers.length;
        const eloRow = ep
          ? `<div class="elo-bar"><span class="elo-val">${ep.elo_home}</span><span>vs</span><span class="elo-val">${ep.elo_away}</span></div>`
          : "";
        rows += `
          <td class="right-border" rowspan="${rs}">
            <span class="league-flag">${game.league_flag}</span>
            <span class="league-name">${game.league_name}</span>
          </td>
          <td class="right-border" rowspan="${rs}" style="min-width:190px">
            <div class="team-main">${game.home_team}</div>
            <div class="team-vs">vs <span style="color:var(--muted);font-weight:400">${game.away_team}</span></div>
            ${ep ? eloRow : ""}
          </td>
          <td class="right-border date-cell" rowspan="${rs}">
            ${fmt(game.commence_time)}
            <br><button class="btn" onclick="openHistory('${gameId}','${safeHome} vs ${safeAway}','${game.commence_time}')" style="margin-top:4px;padding:2px 8px;font-size:11px">📈 Histórico</button>
          </td>`;
      }

      const bmHist = gameHist[bm.key] || [];
      const histH = bmHist.map(x => x.home).filter(v => v > 0);
      const histD = bmHist.map(x => x.draw).filter(v => v > 0);
      const histA = bmHist.map(x => x.away).filter(v => v > 0);

      const vH = ep ? isValueBet(ep.home, bm.home) : null;
      const vD = ep ? isValueBet(ep.draw, bm.draw) : null;
      const vA = ep ? isValueBet(ep.away, bm.away) : null;

      const allBmsEncoded = encodeURIComponent(JSON.stringify(allBmsForGame));

      rows += `
        <td class="right-border" style="font-size:12px;color:var(--muted)">
          ${bm.name}
          <button onclick="openBettingModal('${gameId}','${safeHome}','${safeAway}','${bm.key}','${allBmsEncoded}')"
            style="margin-left:6px;padding:2px 7px;font-size:11px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--muted);cursor:pointer;transition:all .15s"
            onmouseover="this.style.background='var(--blue-bg)';this.style.color='var(--blue)'"
            onmouseout="this.style.background='var(--surface2)';this.style.color='var(--muted)'"
            title="Calcular aposta">🔍</button>
        </td>
        <td style="text-align:center">
          ${badgeWithValue(bm.home, "home", bm.home === bestH && bm.home > 0, isBestView, ep?.home)}
          ${histH.length > 1 ? `<br>${sparklineHtml(histH)}` : ""}
        </td>
        <td style="text-align:center">
          ${badgeWithValue(bm.draw, "draw", bm.draw === bestD && bm.draw > 0, isBestView, ep?.draw)}
          ${histD.length > 1 ? `<br>${sparklineHtml(histD)}` : ""}
        </td>
        <td style="text-align:center">
          ${badgeWithValue(bm.away, "away", bm.away === bestA && bm.away > 0, isBestView, ep?.away)}
          ${histA.length > 1 ? `<br>${sparklineHtml(histA)}` : ""}
        </td>
      </tr>`;
    });
  });

  content.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="left">Liga</th>
            <th class="left">Jogo</th>
            <th class="left">Data / Histórico</th>
            <th class="left">${bmHeader}</th>
            <th class="center">1 Casa</th>
            <th class="center">X Empate</th>
            <th class="center">2 Fora</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  const totalRows = list.reduce((t, g) => t + g.bookmakers.length, 0);
  footer.textContent = `${list.length} jogo${list.length !== 1 ? "s" : ""} · ${totalRows} linha${totalRows !== 1 ? "s" : ""}`;
}

function badgeWithValue(val, field, isBest, isBestView, eloProb) {
  const cls = badgeClass(val, field, isBest, isBestView);
  let suffix = "";
  if (AppState.showElo && eloProb !== undefined && val > 0) {
    const vb = isValueBet(eloProb, val);
    if (vb !== null) {
      const arrow = vb.value ? "▲" : "▼";
      const col = vb.value ? "var(--green)" : "var(--red)";
      suffix = `<span style="font-size:10px;color:${col};margin-left:3px">${arrow}</span>`;
    }
  }
  return `<span class="badge ${cls}">${val > 0 ? val.toFixed(2) : "—"}${suffix}</span>`;
}

function badgeClass(val, field, isBest, isBestView) {
  if (val <= 0) return "badge-empty";
  if (isBest && !isBestView) return "badge-best";
  return "badge-" + field;
}

function renderStats(list) {
  const topH = list.reduce((m, g) => Math.max(m, ...g.bookmakers.map(b => b.home)), 0);
  const topD = list.reduce((m, g) => Math.max(m, ...g.bookmakers.map(b => b.draw)), 0);
  const topA = list.reduce((m, g) => Math.max(m, ...g.bookmakers.map(b => b.away)), 0);

  let valueBets = 0;
  if (AppState.showElo) {
    list.forEach(g => {
      if (!g.elo_probs) return;
      const bm = g.bookmakers[0];
      if ((isValueBet(g.elo_probs.home, bm.home) || {}).value) valueBets++;
      if ((isValueBet(g.elo_probs.draw, bm.draw) || {}).value) valueBets++;
      if ((isValueBet(g.elo_probs.away, bm.away) || {}).value) valueBets++;
    });
  }

  document.getElementById("stat-games").textContent = AppState.loading ? "…" : list.length;
  document.getElementById("stat-home").textContent = AppState.loading ? "…" : f2(topH);
  document.getElementById("stat-draw").textContent = AppState.loading ? "…" : f2(topD);
  document.getElementById("stat-away").textContent = AppState.loading ? "…" : f2(topA);
  document.getElementById("stat-value").textContent = AppState.loading ? "…" : (AppState.showElo ? valueBets : "—");
}

function renderSortBtns() {
  document.querySelectorAll(".sort-btn").forEach(btn => {
    const f = btn.dataset.sort;
    const active = f === AppState.sortField;
    btn.className = "sort-btn" + (active ? " active" : "");
    let label = { date: "Data", game: "Jogo", home: "1 Casa", draw: "X Empate", away: "2 Fora" }[f];
    if (active) label += AppState.sortDir === "asc" ? " ↑" : " ↓";
    btn.textContent = label;
  });
}

function renderClearBtn() {
  const show = AppState.search || AppState.minOdd || AppState.maxOdd || AppState.sortField !== "date";
  document.getElementById("clear-btn").style.display = show ? "" : "none";
}

// ─────────────────────────────────────────────────────
// History Modal
// ─────────────────────────────────────────────────────
async function openHistory(gameId, gameName, commenceTime) {
  document.getElementById("modal-game-title").textContent = gameName;
  document.getElementById("modal-game-date").textContent = fmt(commenceTime);
  document.getElementById("history-modal").style.display = "flex";
  document.getElementById("modal-bm-tabs").innerHTML = '<div style="color:var(--muted);font-size:12px">A carregar…</div>';
  document.getElementById("modal-stats").innerHTML = "";

  const game = AppState.games.find(g => g.id === gameId);
  const hist = await fetchHistory(gameId);

  const bmKeys = Object.keys(hist);
  if (!bmKeys.length) {
    document.getElementById("modal-bm-tabs").innerHTML = "";
    document.getElementById("modal-stats").innerHTML =
      '<div style="color:var(--muted);font-size:13px;padding:1rem 0">Ainda não há histórico de odds para este jogo.</div>';
    renderEloModal(game);
    return;
  }

  const activeBmKey = bmKeys[0];
  renderBmTabsModal(bmKeys, hist, game, activeBmKey);
  renderEloModal(game);
}

function renderBmTabsModal(bmKeys, hist, game, activeBmKey) {
  const container = document.getElementById("modal-bm-tabs");
  const allBms = game?.bookmakers || [];
  container.innerHTML = bmKeys
    .map(k => {
      const bm = allBms.find(b => b.key === k);
      return `<button class="history-bm-tab${k === activeBmKey ? " active" : ""}" data-bm="${k}">${bm ? bm.name : k}</button>`;
    })
    .join("");

  container.querySelectorAll(".history-bm-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".history-bm-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      drawHistoryChart(hist[btn.dataset.bm], game);
      renderModalStats(hist[btn.dataset.bm]);
    });
  });

  drawHistoryChart(hist[activeBmKey], game);
  renderModalStats(hist[activeBmKey]);
}

function renderEloModal(game) {
  const el = document.getElementById("elo-modal-section");
  if (!game?.elo_probs) {
    el.innerHTML = "";
    return;
  }
  const ep = game.elo_probs;
  el.innerHTML = `
    <div class="elo-section">
      <div class="elo-section-title">⚡ Análise ELO Rating</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
        ${game.home_team} (${ep.elo_home}) vs ${game.away_team} (${ep.elo_away}) — diferença: ${
    ep.elo_home - ep.elo_away > 0 ? "+" : ""
  }${ep.elo_home - ep.elo_away}
      </div>
      <div class="elo-prob-row">
        <div class="elo-prob-item">
          <div class="ep-label">Prob. Casa (ELO)</div>
          <div class="ep-val">${pct(ep.home)}</div>
          <div class="ep-odd">Odd justa: ${(1 / ep.home).toFixed(2)}</div>
        </div>
        <div class="elo-prob-item">
          <div class="ep-label">Prob. Empate (ELO)</div>
          <div class="ep-val">${pct(ep.draw)}</div>
          <div class="ep-odd">Odd justa: ${(1 / ep.draw).toFixed(2)}</div>
        </div>
        <div class="elo-prob-item">
          <div class="ep-label">Prob. Fora (ELO)</div>
          <div class="ep-val">${pct(ep.away)}</div>
          <div class="ep-odd">Odd justa: ${(1 / ep.away).toFixed(2)}</div>
        </div>
      </div>
    </div>`;
}

function renderModalStats(entries) {
  if (!entries?.length) return;
  const last = entries[entries.length - 1];
  const first = entries[0];
  document.getElementById("modal-stats").innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--muted)">
      <span>📊 ${entries.length} medições</span>
      <span>🕐 Primeira: ${new Date(first.ts).toLocaleString("pt-PT")}</span>
      <span>🕐 Última: ${new Date(last.ts).toLocaleString("pt-PT")}</span>
      <span>Casa: ${first.home.toFixed(2)} → ${last.home.toFixed(2)} ${trendArrow(entries.map(e => e.home))}</span>
      <span>Empate: ${first.draw.toFixed(2)} → ${last.draw.toFixed(2)} ${trendArrow(entries.map(e => e.draw))}</span>
      <span>Fora: ${first.away.toFixed(2)} → ${last.away.toFixed(2)} ${trendArrow(entries.map(e => e.away))}</span>
    </div>`;
}

function drawHistoryChart(entries, game) {
  const canvas = document.getElementById("history-canvas");
  const ctx = canvas.getContext("2d");

  if (!entries?.length) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const W = canvas.parentElement.clientWidth || 600;
  const H = 220;
  canvas.width = W;
  canvas.height = H;

  const PAD = { top: 20, right: 20, bottom: 40, left: 48 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;

  const allVals = [...entries.map(e => e.home), ...entries.map(e => e.draw), ...entries.map(e => e.away)].filter(v => v > 0);
  const minV = Math.min(...allVals) - 0.1;
  const maxV = Math.max(...allVals) + 0.1;
  const range = maxV - minV || 1;

  function xPos(i) {
    return PAD.left + (i / Math.max(entries.length - 1, 1)) * CW;
  }
  function yPos(v) {
    return PAD.top + CH - ((v - minV) / range) * CH;
  }

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#161b22";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (i / 4) * CH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + CW, y);
    ctx.stroke();
    const val = maxV - (i / 4) * range;
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(val.toFixed(2), PAD.left - 6, y + 4);
  }

  const series = [
    { data: entries.map(e => e.home), color: "#58a6ff", label: "1 Casa" },
    { data: entries.map(e => e.draw), color: "#8b949e", label: "X Empate" },
    { data: entries.map(e => e.away), color: "#d29922", label: "2 Fora" }
  ];

  series.forEach(({ data, color }) => {
    const pts = data.map((v, i) => [xPos(i), yPos(v)]).filter(([, y]) => isFinite(y));
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pts[0][0], PAD.top + CH);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(pts[pts.length - 1][0], PAD.top + CH);
    ctx.closePath();
    ctx.fillStyle = color + "18";
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();

    const [lx, ly] = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  const labelIdxs = [0, Math.floor(entries.length / 3), Math.floor((2 * entries.length) / 3), entries.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  ctx.fillStyle = "#8b949e";
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  labelIdxs.forEach(i => {
    const d = new Date(entries[i].ts);
    const txt = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
    ctx.fillText(txt, xPos(i), H - 8);
  });

  let lx = PAD.left;
  series.forEach(({ label, color }) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx, 6, 18, 3);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "11px system-ui";
    ctx.textAlign = "left";
    ctx.fillText(label, lx + 22, 14);
    lx += ctx.measureText(label).width + 48;
  });
}

// ─────────────────────────────────────────────────────
// Export to global scope
// ─────────────────────────────────────────────────────
window.initOddsPanel = initOddsPanel;
window.renderOddsContent = renderOddsContent;
