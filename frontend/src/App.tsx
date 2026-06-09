import { useState, useEffect, useRef, useMemo } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

interface League { key: string; name: string; country: string; flag: string; }
interface BookmakerOdds { key: string; name: string; home: number; draw: number; away: number; last_update: string | null; }
interface Game { id: string; league_key: string; league_name: string; league_flag: string; home_team: string; away_team: string; commence_time: string; bookmakers: BookmakerOdds[]; }
interface Bookmaker { key: string; name: string; }

type SortField = "date" | "home" | "draw" | "away" | "game";
type SortDir = "asc" | "desc";
type ViewMode = "all-bookmakers" | "best-odds";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function OddBadge({ val, field, isBest }: { val: number; field: "home" | "draw" | "away"; isBest: boolean }) {
  const colors: Record<string, [string, string]> = {
    empty:  ["#f1f5f9", "#94a3b8"],
    best:   ["#dcfce7", "#15803d"],
    home:   ["#eff6ff", "#1d4ed8"],
    draw:   ["#f8fafc", "#475569"],
    away:   ["#fff7ed", "#c2410c"],
  };
  const [bg, color] = val === 0 ? colors.empty : isBest ? colors.best : colors[field];
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontWeight: 600, fontSize: 13, background: bg, color, minWidth: 52, textAlign: "center" }}>
      {val > 0 ? val.toFixed(2) : "—"}
    </span>
  );
}

function SortBtn({ label, field, current, dir, onClick }: { label: string; field: SortField; current: SortField; dir: SortDir; onClick: (f: SortField) => void }) {
  const active = current === field;
  return (
    <button onClick={() => onClick(field)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 6, border: `1px solid ${active ? "#2563eb" : "#e2e8f0"}`, background: active ? "#eff6ff" : "transparent", color: active ? "#1d4ed8" : "#64748b", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>
      {label}
      {active && <span style={{ fontSize: 10 }}>{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

export default function App() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [games, setGames] = useState<Game[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [selectedBook, setSelectedBook] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("all-bookmakers");
  const [minOdd, setMinOdd] = useState("");
  const [maxOdd, setMaxOdd] = useState("");
  const [oddFocus, setOddFocus] = useState<"all" | "home" | "draw" | "away">("all");

  const bookmakersFetched = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/leagues`).then(r => r.json()).then(setLeagues).catch(console.error);
  }, []);

  useEffect(() => {
    if (bookmakersFetched.current) return;
    bookmakersFetched.current = true;
    fetch(`${API_BASE}/bookmakers`).then(r => r.json()).then((d: Bookmaker[]) => { if (d?.length) setBookmakers(d); }).catch(console.error);
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedBook !== "all") params.set("bookmakers", selectedBook);
    const url = `${API_BASE}/odds/${selectedLeague}${params.toString() ? "?" + params : ""}`;
    fetch(url, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d: Game[]) => { setGames(d); setLastUpdate(new Date().toLocaleTimeString("pt-PT")); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [selectedLeague, selectedBook]);

  // Build list: if viewMode=best-odds, collapse each game to 1 row showing best odds per outcome
  const baseGames: (Game & { _isBestRow?: boolean })[] = useMemo(() => {
    let list = selectedBook === "all"
      ? games
      : games.map(g => ({ ...g, bookmakers: g.bookmakers.filter(b => b.key === selectedBook) })).filter(g => g.bookmakers.length > 0);

    if (viewMode === "best-odds") {
      list = list.map(g => {
        const bestH = Math.max(...g.bookmakers.map(b => b.home));
        const bestD = Math.max(...g.bookmakers.map(b => b.draw));
        const bestA = Math.max(...g.bookmakers.map(b => b.away));
        const bmH = g.bookmakers.find(b => b.home === bestH);
        const bmD = g.bookmakers.find(b => b.draw === bestD);
        const bmA = g.bookmakers.find(b => b.away === bestA);
        return {
          ...g,
          _isBestRow: true,
          bookmakers: [{
            key: "best",
            name: `${bmH?.name ?? "—"} / ${bmD?.name ?? "—"} / ${bmA?.name ?? "—"}`,
            home: bestH,
            draw: bestD,
            away: bestA,
            last_update: null,
          }],
        };
      });
    }
    return list;
  }, [games, selectedBook, viewMode]);

  // Apply search + odd range filter + sort
  const filtered = useMemo(() => {
    let list = baseGames;

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(g =>
        g.home_team.toLowerCase().includes(q) ||
        g.away_team.toLowerCase().includes(q) ||
        g.league_name.toLowerCase().includes(q)
      );
    }

    // Odd range filter
    const min = parseFloat(minOdd);
    const max = parseFloat(maxOdd);
    if (!isNaN(min) || !isNaN(max)) {
      list = list.map(g => ({
        ...g,
        bookmakers: g.bookmakers.filter(bm => {
          const vals = oddFocus === "all"
            ? [bm.home, bm.draw, bm.away].filter(v => v > 0)
            : [bm[oddFocus]].filter(v => v > 0);
          if (!vals.length) return false;
          return vals.some(v => (!isNaN(min) ? v >= min : true) && (!isNaN(max) ? v <= max : true));
        }),
      })).filter(g => g.bookmakers.length > 0);
    }

    // Sort
    list = [...list].sort((a, b) => {
      let va: number, vb: number;
      if (sortField === "date") {
        va = new Date(a.commence_time).getTime();
        vb = new Date(b.commence_time).getTime();
      } else if (sortField === "game") {
        return sortDir === "asc"
          ? (a.home_team + a.away_team).localeCompare(b.home_team + b.away_team)
          : (b.home_team + b.away_team).localeCompare(a.home_team + a.away_team);
      } else {
        va = Math.max(...a.bookmakers.map(bm => bm[sortField as "home" | "draw" | "away"]));
        vb = Math.max(...b.bookmakers.map(bm => bm[sortField as "home" | "draw" | "away"]));
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return list;
  }, [baseGames, search, minOdd, maxOdd, oddFocus, sortField, sortDir]);

  function handleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir(f === "date" ? "asc" : "desc"); }
  }

  const totalGames = filtered.length;
  const topHome = useMemo(() => filtered.reduce((m, g) => Math.max(m, ...g.bookmakers.map(b => b.home)), 0), [filtered]);
  const topAway = useMemo(() => filtered.reduce((m, g) => Math.max(m, ...g.bookmakers.map(b => b.away)), 0), [filtered]);
  const topDraw = useMemo(() => filtered.reduce((m, g) => Math.max(m, ...g.bookmakers.map(b => b.draw)), 0), [filtered]);

  const tabStyle = (active: boolean) => ({
    padding: "5px 14px", borderRadius: 20, border: "0.5px solid",
    borderColor: active ? "#2563eb" : "#e2e8f0",
    background: active ? "#eff6ff" : "transparent",
    color: active ? "#1d4ed8" : "#64748b",
    fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer",
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem", color: "#0f172a" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>⚽ Odds Dashboard</h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Ligas europeias e internacionais</p>
      </div>

      {/* Top controls: refresh + view mode */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => { setGames([]); setSelectedLeague(l => l); }} disabled={loading}
          style={{ padding: "7px 14px", background: loading ? "#f1f5f9" : "#dcfce7", color: loading ? "#94a3b8" : "#15803d", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: loading ? "default" : "pointer", fontWeight: 500 }}>
          {loading ? "A carregar..." : "↺ Atualizar"}
        </button>
        {lastUpdate && <span style={{ fontSize: 12, color: "#94a3b8" }}>Atualizado às {lastUpdate}</span>}

        <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center", flexWrap: "wrap" }}>
          {/* View mode toggle */}
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 2, gap: 2 }}>
            {(["all-bookmakers", "best-odds"] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: viewMode === m ? "#fff" : "transparent", color: viewMode === m ? "#1d4ed8" : "#64748b", fontSize: 12, fontWeight: viewMode === m ? 600 : 400, cursor: "pointer", boxShadow: viewMode === m ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                {m === "all-bookmakers" ? "Todos os bookmakers" : "Melhores odds"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: "1rem" }}>
          ⚠ {error}
        </div>
      )}

      {/* League tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1rem" }}>
        {[{ key: "all", name: "Todas", flag: "⚽" }, ...leagues].map(l => (
          <button key={l.key} onClick={() => setSelectedLeague(l.key)} style={tabStyle(selectedLeague === l.key)}>
            {l.flag} {l.name}
          </button>
        ))}
      </div>

      {/* Bookmakers tabs */}
      {bookmakers.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", fontWeight: 500 }}>Casas de Apostas</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setSelectedBook("all")} style={tabStyle(selectedBook === "all")}>
              ✓ Todas
            </button>
            {bookmakers.map(b => (
              <button key={b.key} onClick={() => setSelectedBook(b.key)} style={tabStyle(selectedBook === b.key)}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.25rem" }}>
        {[
          { label: "Jogos", val: loading ? "..." : String(totalGames), color: "#1d4ed8", bg: "#eff6ff" },
          { label: "Melhor casa", val: loading ? "..." : topHome > 0 ? topHome.toFixed(2) : "—", color: "#15803d", bg: "#dcfce7" },
          { label: "Melhor empate", val: loading ? "..." : topDraw > 0 ? topDraw.toFixed(2) : "—", color: "#475569", bg: "#f8fafc" },
          { label: "Melhor fora", val: loading ? "..." : topAway > 0 ? topAway.toFixed(2) : "—", color: "#c2410c", bg: "#fff7ed" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "8px 16px", minWidth: 100, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "grid", gap: 12, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: "1rem" }}>
        {/* Row 1: Search + Sort buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Pesquisar equipa ou liga..."
            style={{ flex: "1 1 200px", padding: "7px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff", minWidth: 160 }}
          />

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: "#e2e8f0", display: "none" }} />

          {/* Sort buttons */}
          <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>Ordenar:</span>
          <SortBtn label="Data" field="date" current={sortField} dir={sortDir} onClick={handleSort} />
          <SortBtn label="Jogo" field="game" current={sortField} dir={sortDir} onClick={handleSort} />
          <SortBtn label="Odd casa" field="home" current={sortField} dir={sortDir} onClick={handleSort} />
        </div>

        {/* Row 2: More sort + Odd range filter + Clear */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SortBtn label="Odd empate" field="draw" current={sortField} dir={sortDir} onClick={handleSort} />
          <SortBtn label="Odd fora" field="away" current={sortField} dir={sortDir} onClick={handleSort} />

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: "#e2e8f0", marginLeft: 4 }} />

          {/* Odd range filter */}
          <span style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>Odds entre:</span>
          <input type="number" value={minOdd} onChange={e => setMinOdd(e.target.value)} placeholder="Mín" step="0.1" min="1"
            style={{ width: 64, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>e</span>
          <input type="number" value={maxOdd} onChange={e => setMaxOdd(e.target.value)} placeholder="Máx" step="0.1" min="1"
            style={{ width: 64, padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" }} />

          {/* Odd focus */}
          <select value={oddFocus} onChange={e => setOddFocus(e.target.value as typeof oddFocus)}
            style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, background: "#fff" }}>
            <option value="all">Qualquer odd</option>
            <option value="home">Só casa (1)</option>
            <option value="draw">Só empate (X)</option>
            <option value="away">Só fora (2)</option>
          </select>

          {/* Clear filters */}
          {(search || minOdd || maxOdd || sortField !== "date") && (
            <button onClick={() => { setSearch(""); setMinOdd(""); setMaxOdd(""); setSortField("date"); setSortDir("asc"); setOddFocus("all"); }}
              style={{ marginLeft: "auto", padding: "6px 12px", border: "1px solid #fca5a5", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* Loading / empty */}
      {loading && games.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontSize: 14 }}>A carregar odds...</div>
      )}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontSize: 14 }}>
          Nenhum jogo encontrado. Experimenta ajustar os filtros.
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {[
                  { label: "Liga", align: "left" },
                  { label: "Jogo", align: "left" },
                  { label: "Data", align: "left" },
                  { label: viewMode === "best-odds" ? "Melhor bookmaker (1/X/2)" : "Bookmaker", align: "left" },
                  { label: "1 Casa", align: "center" },
                  { label: "X Empate", align: "center" },
                  { label: "2 Fora", align: "center" },
                ].map(h => (
                  <th key={h.label} style={{ padding: "10px 12px", textAlign: h.align as "left" | "center", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(game => {
                const bestH = Math.max(...game.bookmakers.map(b => b.home));
                const bestD = Math.max(...game.bookmakers.map(b => b.draw));
                const bestA = Math.max(...game.bookmakers.map(b => b.away));
                const isBestView = game._isBestRow;

                return game.bookmakers.map((bm, idx) => (
                  <tr key={`${game.id}-${bm.key}`}
                    style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                    {idx === 0 && (
                      <>
                        <td rowSpan={game.bookmakers.length} style={{ padding: "10px 12px", whiteSpace: "nowrap", borderRight: "1px solid #f1f5f9" }}>
                          <span style={{ fontSize: 15 }}>{game.league_flag}</span>{" "}
                          <span style={{ color: "#64748b", fontSize: 12 }}>{game.league_name}</span>
                        </td>
                        <td rowSpan={game.bookmakers.length} style={{ padding: "10px 12px", fontWeight: 600, borderRight: "1px solid #f1f5f9", minWidth: 180 }}>
                          <div>{game.home_team}</div>
                          <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 400 }}>vs {game.away_team}</div>
                        </td>
                        <td rowSpan={game.bookmakers.length} style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12, borderRight: "1px solid #f1f5f9" }}>
                          {formatDate(game.commence_time)}
                        </td>
                      </>
                    )}
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: isBestView ? "#64748b" : "#0f172a", fontSize: isBestView ? 11 : 13, borderRight: "1px solid #f1f5f9" }}>
                      {bm.name}
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <OddBadge val={bm.home} field="home" isBest={bm.home === bestH && bm.home > 0 && !isBestView} />
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <OddBadge val={bm.draw} field="draw" isBest={bm.draw === bestD && bm.draw > 0 && !isBestView} />
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "center" }}>
                      <OddBadge val={bm.away} field="away" isBest={bm.away === bestA && bm.away > 0 && !isBestView} />
                    </td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "1rem", fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
        {filtered.length} jogo{filtered.length !== 1 ? "s" : ""} · {filtered.reduce((t, g) => t + g.bookmakers.length, 0)} linha{filtered.reduce((t, g) => t + g.bookmakers.length, 0) !== 1 ? "s" : ""}
      </div>
    </div>
  );
}