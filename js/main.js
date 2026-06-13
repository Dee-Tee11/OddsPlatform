/**
 * OddsDash - Main Application Logic
 * Shared state, helpers, and core functionality
 */

// ─────────────────────────────────────────────────────
// API & Config
// ─────────────────────────────────────────────────────
const API_BASE = "/api";

const LEAGUES = {
  "soccer_england_premier_league":  { name: "Premier League",   flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "soccer_spain_la_liga":           { name: "La Liga",          flag: "🇪🇸" },
  "soccer_italy_serie_a":           { name: "Serie A",          flag: "🇮🇹" },
  "soccer_germany_bundesliga":      { name: "Bundesliga",       flag: "🇩🇪" },
  "soccer_france_ligue_one":        { name: "Ligue 1",          flag: "🇫🇷" },
  "soccer_portugal_primeira_liga":  { name: "Primeira Liga",    flag: "🇵🇹" },
  "soccer_uefa_champs_league":      { name: "Champions League", flag: "🏆" },
  "soccer_uefa_europa_league":      { name: "Europa League",    flag: "🥈" },
  "soccer_uefa_nations_league":     { name: "Nations League",   flag: "🌍" },
  "soccer_usa_mls":                 { name: "MLS",              flag: "🇺🇸" },
  "soccer_brazil_campeonato":       { name: "Brasileirão",      flag: "🇧🇷" },
  "soccer_argentina_primera_div":   { name: "Primera División", flag: "🇦🇷" },
  "soccer_conmebol_copa_america":   { name: "Copa América",     flag: "🌎" },
  "soccer_fifa_world_cup":          { name: "World Cup",        flag: "🌐" },
  "soccer_turkey_super_lig":        { name: "Süper Lig",        flag: "🇹🇷" },
  "soccer_netherlands_eredivisie":  { name: "Eredivisie",       flag: "🇳🇱" },
  "soccer_australia_aleague":       { name: "A-League",         flag: "🇦🇺" },
  "soccer_japan_j_league":          { name: "J-League",         flag: "🇯🇵" },
  "soccer_mexico_ligamx":           { name: "Liga MX",          flag: "🇲🇽" },
};

const TOP_LEAGUE_KEYS = [
  "soccer_england_premier_league",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_portugal_primeira_liga",
  "soccer_uefa_champs_league",
];

// ─────────────────────────────────────────────────────
// Global State
// ─────────────────────────────────────────────────────
const AppState = {
  games: [],
  bookmakers: [],
  selectedLeague: "top",
  selectedBook: "all",
  viewMode: "best-odds",
  sortField: "date",
  sortDir: "asc",
  search: "",
  minOdd: "",
  maxOdd: "",
  oddFocus: "all",
  loading: false,
  bmFetched: false,
  showElo: false,
  valueOnly: false,
  historyCache: {},
  currentBettingGame: null,
  selectedBetType: "home",
};

// ─────────────────────────────────────────────────────
// DATA CACHE  (localStorage, TTL 2 min)
// ─────────────────────────────────────────────────────
const CACHE_KEY    = "oddsdash_games";
const CACHE_TS_KEY = "oddsdash_games_ts";
const CACHE_LG_KEY = "oddsdash_games_league";
const CACHE_BM_KEY = "oddsdash_bookmakers";
const CACHE_TTL    = 2 * 60 * 1000; // 2 minutos em ms

function saveCache(games, leagueKey) {
  try {
    localStorage.setItem(CACHE_KEY,    JSON.stringify(games));
    localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
    localStorage.setItem(CACHE_LG_KEY, leagueKey);
  } catch (_) { /* quota — ignora silenciosamente */ }
}

function saveBookmarkersCache(bms) {
  try { localStorage.setItem(CACHE_BM_KEY, JSON.stringify(bms)); } catch (_) {}
}

function loadBookmarkersCache() {
  try {
    const raw = localStorage.getItem(CACHE_BM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadCache(leagueKey) {
  try {
    const ts     = parseInt(localStorage.getItem(CACHE_TS_KEY) || "0", 10);
    const league = localStorage.getItem(CACHE_LG_KEY);
    if (league !== leagueKey)         return null; // liga diferente
    if (Date.now() - ts > CACHE_TTL) return null; // expirou
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearCache() {
  [CACHE_KEY, CACHE_TS_KEY, CACHE_LG_KEY].forEach(k => localStorage.removeItem(k));
}

function cacheTimestamp() {
  const ts = parseInt(localStorage.getItem(CACHE_TS_KEY) || "0", 10);
  return ts ? new Date(ts).toLocaleTimeString("pt-PT") : null;
}

// ─────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────
function fmt(iso) {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function f2(n) { return n > 0 ? n.toFixed(2) : "—"; }
function pct(p) { return (p * 100).toFixed(1) + "%"; }
function curr(n) { return "€" + n.toFixed(2); }

function impliedProb(odd) { return odd > 0 ? 1 / odd : 0; }

function isValueBet(eloProb, odd) {
  if (!eloProb || !odd || odd <= 0) return null;
  const implied = impliedProb(odd);
  const edge = eloProb - implied;
  return { value: edge > 0, edge: edge, implied };
}

function sparklineHtml(values) {
  if (!values || values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 0.01;
  const bars = values.slice(-8).map(v => {
    const h = Math.max(3, Math.round(((v - min) / range) * 16));
    const last = v === values[values.length - 1];
    const color = last ? "var(--blue)" : "var(--subtle)";
    return `<div class="spark-bar" style="height:${h}px;background:${color}"></div>`;
  }).join("");
  return `<div class="sparkline">${bars}</div>`;
}

function trendArrow(values) {
  if (!values || values.length < 2) return "";
  const diff = values[values.length - 1] - values[0];
  if (Math.abs(diff) < 0.01) return `<span class="trend-flat">→</span>`;
  if (diff > 0) return `<span class="trend-up">↑ +${diff.toFixed(2)}</span>`;
  return `<span class="trend-down">↓ ${diff.toFixed(2)}</span>`;
}

// ─────────────────────────────────────────────────────
// API Calls
// ─────────────────────────────────────────────────────
async function fetchBookmakers() {
  if (AppState.bmFetched) return;

  // Tenta cache de bookmakers primeiro (não expira — mudam raramente)
  const cached = loadBookmarkersCache();
  if (cached && cached.length) {
    AppState.bookmakers = cached;
    AppState.bmFetched = true;
    if (window.initOddsPanel) initOddsPanel();
    return;
  }

  AppState.bmFetched = true;
  try {
    const r = await fetch(`${API_BASE}/bookmakers`);
    if (!r.ok) return;
    const d = await r.json();
    if (d?.length) {
      AppState.bookmakers = d;
      saveBookmarkersCache(d);
      if (window.initOddsPanel) initOddsPanel();
    }
  } catch (e) {
    console.error("Error fetching bookmakers:", e);
  }
}

async function fetchOdds() {
  // 1. Tenta cache primeiro — resposta instantânea entre tabs
  const cached = loadCache(AppState.selectedLeague);
  if (cached) {
    AppState.games = cached;
    const ts = cacheTimestamp();
    document.getElementById("last-update").textContent =
      ts ? `Cache · ${ts}` : "";
    _afterFetch();
    return;
  }

  // 2. Sem cache válido — vai à API
  AppState.loading = true;
  setError(null);
  _afterFetch(); // mostra spinner

  try {
    const params = AppState.selectedBook !== "all"
      ? `?bookmakers=${AppState.selectedBook}` : "";
    const r = await fetch(`${API_BASE}/odds/${AppState.selectedLeague}${params}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    AppState.games = await r.json();

    saveCache(AppState.games, AppState.selectedLeague);

    document.getElementById("last-update").textContent =
      "Atualizado às " + new Date().toLocaleTimeString("pt-PT");
  } catch (e) {
    setError(e.message);
  } finally {
    AppState.loading = false;
    _afterFetch();
  }
}

function _afterFetch() {
  if (window.refreshArbScanner) window.refreshArbScanner();
  if (window.renderOddsContent) window.renderOddsContent();
}

async function fetchHistory(gameId) {
  if (AppState.historyCache[gameId]) return AppState.historyCache[gameId];
  try {
    const r = await fetch(`${API_BASE}/odds-history/${gameId}`);
    if (!r.ok) return {};
    const d = await r.json();
    AppState.historyCache[gameId] = d;
    return d;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────
// Common UI
// ─────────────────────────────────────────────────────
function setError(msg) {
  const el = document.getElementById("error-banner");
  if (msg) {
    el.textContent = "⚠ " + msg;
    el.style.display = "";
  } else {
    el.style.display = "none";
  }
}

// ─────────────────────────────────────────────────────
// Navigation — marca a tab activa pela URL
// ─────────────────────────────────────────────────────
function initNavigation() {
  const current = window.location.pathname.split("/").pop() || "odds.html";
  document.querySelectorAll(".nav-tab").forEach(tab => {
    const href = tab.getAttribute("href");
    tab.classList.toggle("active",
      href === current || (current === "" && href === "odds.html"));
  });
}

document.addEventListener("DOMContentLoaded", initNavigation);
if (document.readyState !== "loading") initNavigation();

// ─────────────────────────────────────────────────────
// Refresh button — força fetch ignorando cache
// ─────────────────────────────────────────────────────
document.getElementById("refresh-btn").addEventListener("click", () => {
  if (AppState.loading) return;
  clearCache();
  fetchOdds();
});

// ─────────────────────────────────────────────────────
// Betting Modal (Shared)
// ─────────────────────────────────────────────────────
function openBettingModal(gameId, homeTeam, awayTeam, activeBmKey, allBmsEncoded) {
  const allBms = typeof allBmsEncoded === "string"
    ? JSON.parse(decodeURIComponent(allBmsEncoded))
    : allBmsEncoded;
  const game = AppState.games.find(g => g.id === gameId);

  AppState.currentBettingGame = { gameId, homeTeam, awayTeam, allBms, game };
  AppState.selectedBetType = "home";

  document.getElementById("betting-modal-game").textContent = `${homeTeam} vs ${awayTeam}`;
  document.getElementById("betting-modal-info").textContent = game
    ? `${game.league_name} · ${fmt(game.commence_time)}`
    : "";

  const bmSel = document.getElementById("modal-bm-select");
  bmSel.innerHTML = allBms
    .map(b =>
      `<option value="${b.key}">${b.name} — 1:${b.home > 0 ? b.home.toFixed(2) : "?"} X:${b.draw > 0 ? b.draw.toFixed(2) : "?"} 2:${b.away > 0 ? b.away.toFixed(2) : "?"}</option>`
    )
    .join("");
  bmSel.value = activeBmKey;

  document.getElementById("btt-home").textContent = homeTeam;
  document.getElementById("btt-away").textContent = awayTeam;

  const ep = game?.elo_probs;
  const bm = allBms.find(b => b.key === activeBmKey) || allBms[0];
  let valueBadgeHtml = "";
  if (ep && bm) {
    const vH = isValueBet(ep.home, bm.home);
    const vD = isValueBet(ep.draw, bm.draw);
    const vA = isValueBet(ep.away, bm.away);
    const anyValue = (vH && vH.value) || (vD && vD.value) || (vA && vA.value);
    valueBadgeHtml = anyValue
      ? `<div style="background:var(--green-bg);border:1px solid var(--green-dim);border-radius:6px;padding:8px 12px;margin-bottom:12px;color:var(--green);font-size:12px">⚡ Aposta de valor detectada pelo ELO</div>`
      : `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;margin-bottom:12px;color:var(--muted);font-size:12px">📉 Sem valor claro vs probabilidades ELO</div>`;
  }
  document.getElementById("betting-value-badge").innerHTML = valueBadgeHtml;

  updateBmOddsDisplay();
  selectBetType("home");

  document.getElementById("betting-stake-input").value = 100;
  updateBettingCalc();

  document.getElementById("betting-modal").style.display = "flex";
}

function onBmSelectChange() {
  updateBmOddsDisplay();
  updateBettingCalc();
}

function updateBmOddsDisplay() {
  if (!AppState.currentBettingGame) return;
  const bmKey = document.getElementById("modal-bm-select").value;
  const bm = AppState.currentBettingGame.allBms.find(b => b.key === bmKey) ||
    AppState.currentBettingGame.allBms[0];
  if (!bm) return;

  document.getElementById("bto-home").textContent = bm.home > 0 ? bm.home.toFixed(2) : "—";
  document.getElementById("bto-draw").textContent = bm.draw > 0 ? bm.draw.toFixed(2) : "—";
  document.getElementById("bto-away").textContent = bm.away > 0 ? bm.away.toFixed(2) : "—";
}

function selectBetType(type) {
  AppState.selectedBetType = type;
  ["home", "draw", "away"].forEach(t => {
    const card = document.getElementById("btc-" + t);
    card.className = "bet-type-card";
    const existing = card.querySelector(".bet-type-selected-badge");
    if (existing) existing.remove();
  });
  const card = document.getElementById("btc-" + type);
  const colorClass = { home: "selected-home", draw: "selected-draw", away: "selected-away" }[type];
  card.classList.add(colorClass);
  const badge = document.createElement("div");
  badge.className = "bet-type-selected-badge";
  badge.textContent = "✓ Selecionado";
  card.appendChild(badge);
  updateBettingCalc();
}

function setStake(v) {
  document.getElementById("betting-stake-input").value = v;
  updateBettingCalc();
}

function updateBettingCalc() {
  if (!AppState.currentBettingGame) return;
  const bmKey = document.getElementById("modal-bm-select").value;
  const bm = AppState.currentBettingGame.allBms.find(b => b.key === bmKey) ||
    AppState.currentBettingGame.allBms[0];
  if (!bm) return;

  const odd = bm[AppState.selectedBetType] || 0;
  const stake = parseFloat(document.getElementById("betting-stake-input").value) || 0;
  const ret = stake * odd;
  const profit = ret - stake;

  const typeLabels = {
    home: `1 Casa (${AppState.currentBettingGame.homeTeam})`,
    draw: "X Empate",
    away: `2 Fora (${AppState.currentBettingGame.awayTeam})`
  };

  document.getElementById("br-type").textContent = typeLabels[AppState.selectedBetType] || "—";
  document.getElementById("br-odd").textContent = odd > 0 ? odd.toFixed(2) : "—";
  document.getElementById("br-stake").textContent = stake > 0 ? curr(stake) : "—";
  document.getElementById("br-return").textContent = ret > 0 ? curr(ret) : "—";
  document.getElementById("br-profit").textContent = profit > 0 ? curr(profit) : "—";
}

function closeBettingModal() {
  document.getElementById("betting-modal").style.display = "none";
  AppState.currentBettingGame = null;
}

function copyBettingInfo() {
  if (!AppState.currentBettingGame) return;
  const bmKey = document.getElementById("modal-bm-select").value;
  const bm = AppState.currentBettingGame.allBms.find(b => b.key === bmKey) ||
    AppState.currentBettingGame.allBms[0];
  const odd = bm ? bm[AppState.selectedBetType] : 0;
  const stake = parseFloat(document.getElementById("betting-stake-input").value) || 0;
  const typeLabels = { home: "1 Casa", draw: "X Empate", away: "2 Fora" };
  const text = [
    `🎯 ${AppState.currentBettingGame.homeTeam} vs ${AppState.currentBettingGame.awayTeam}`,
    `🏦 ${bm?.name || "—"}`,
    `📌 Aposta: ${typeLabels[AppState.selectedBetType]}`,
    `📊 Odd: ${odd > 0 ? odd.toFixed(2) : "—"}`,
    `💰 Valor: ${curr(stake)}`,
    `💵 Retorno potencial: ${curr(stake * odd)}`,
    `📈 Lucro potencial: ${curr(stake * odd - stake)}`,
  ].join("\n");
  navigator.clipboard.writeText(text).catch(() => {});
  const btn = document.querySelector(".betting-btn-main");
  const orig = btn.textContent;
  btn.textContent = "✅ Copiado!";
  setTimeout(() => (btn.textContent = orig), 2000);
}

// Modal closes
document.getElementById("betting-modal-close").addEventListener("click", closeBettingModal);
document.getElementById("betting-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("betting-modal")) closeBettingModal();
});

document.getElementById("modal-close-btn").addEventListener("click", () => {
  document.getElementById("history-modal").style.display = "none";
});
document.getElementById("history-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("history-modal"))
    document.getElementById("history-modal").style.display = "none";
});

// ─────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const oddsPanel      = document.getElementById("panel-odds");
  const hedgingPanel   = document.getElementById("panel-hedging");
  const arbitragePanel = document.getElementById("panel-arbitrage");

  if (oddsPanel) {
    fetchBookmakers();
    fetchOdds();
  } else if (hedgingPanel && window.initHedgingPanel) {
    fetchBookmakers();
    fetchOdds();
    window.initHedgingPanel();
  } else if (arbitragePanel && window.initArbitragePanel) {
    fetchBookmakers();
    fetchOdds();
    window.initArbitragePanel();
  }
});