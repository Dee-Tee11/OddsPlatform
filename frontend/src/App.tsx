import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:8000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface League {
  key: string;
  name: string;
  country: string;
  flag: string;
}

interface BookmakerOdds {
  key: string;
  name: string;
  home: number;
  draw: number;
  away: number;
  last_update: string | null;
}

interface Game {
  id: string;
  league_key: string;
  league_name: string;
  league_flag: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: BookmakerOdds[];
}

interface Bookmaker {
  key: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bestOdd(games: Game[], field: "home" | "draw" | "away") {
  let best = 0;
  games.forEach((g) =>
    g.bookmakers.forEach((b) => {
      if (b[field] > best) best = b[field];
    })
  );
  return best;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState("all");
  const [games, setGames] = useState<Game[]>([]);
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([]);
  const [selectedBook, setSelectedBook] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Load static leagues list once
  useEffect(() => {
    fetch(`${API_BASE}/leagues`)
      .then((r) => r.json())
      .then(setLeagues)
      .catch(() => {});
  }, []);

  const loadOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedBook !== "all") params.set("bookmakers", selectedBook);

      const res = await fetch(`${API_BASE}/odds/${selectedLeague}?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Erro desconhecido");
      }
      const data: Game[] = await res.json();
      setGames(data);
      setLastUpdate(new Date().toLocaleTimeString("pt-PT"));

      // Also load bookmakers if not yet loaded
      if (bookmakers.length === 0) {
        const bmRes = await fetch(`${API_BASE}/bookmakers`);
        if (bmRes.ok) setBookmakers(await bmRes.json());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [selectedLeague, selectedBook, bookmakers.length]);

  // Auto-reload when league or book changes
  useEffect(() => {
    loadOdds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeague, selectedBook]);

  // ── Filtered games
  const filtered = selectedBook === "all"
    ? games
    : games.map((g) => ({
        ...g,
        bookmakers: g.bookmakers.filter((b) => b.key === selectedBook),
      })).filter((g) => g.bookmakers.length > 0);

  const topHome = bestOdd(filtered, "home");
  const topAway = bestOdd(filtered, "away");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem" }}>

      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>⚽ Odds Dashboard</h1>
        <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>
          Top 5 Ligas Europeias + Primeira Liga Portuguesa
        </p>
      </div>

      {/* Refresh Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={loadOdds}
          disabled={loading}
          style={{ padding: "8px 16px", background: loading ? "#aaa" : "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: loading ? "default" : "pointer" }}
        >
          {loading ? "A carregar..." : "🔄 Atualizar"}
        </button>
        {lastUpdate && <span style={{ fontSize: 12, color: "#888" }}>Atualizado às {lastUpdate}</span>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: "1rem" }}>
          ⚠️ {error}
        </div>
      )}

      {/* League Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "1rem" }}>
        {[{ key: "all", name: "Todas", flag: "⚽" }, ...leagues].map((l) => (
          <button
            key={l.key}
            onClick={() => setSelectedLeague(l.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: selectedLeague === l.key ? "#2563eb" : "#ddd",
              background: selectedLeague === l.key ? "#eff6ff" : "#fff",
              color: selectedLeague === l.key ? "#1d4ed8" : "#555",
              fontSize: 13,
              fontWeight: selectedLeague === l.key ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {l.flag} {l.name}
          </button>
        ))}
      </div>

      {/* Stats + Bookmaker Filter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        {/* Stat cards */}
        {[
          { label: "Jogos", val: filtered.length },
          { label: "Melhor casa", val: topHome > 0 ? topHome.toFixed(2) : "—" },
          { label: "Melhor fora", val: topAway > 0 ? topAway.toFixed(2) : "—" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 16px", minWidth: 90 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{s.val}</div>
          </div>
        ))}

        {/* Bookmaker filter */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: "#666" }}>Bookmaker:</label>
          <select
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
            style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, fontSize: 13 }}
          >
            <option value="all">Todos</option>
            {bookmakers.length === 0 && <option value="22bet">22bet</option>}
            {bookmakers.map((b) => (
              <option key={b.key} value={b.key}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 && !loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8", fontSize: 14 }}>
          Nenhum jogo encontrado. Experimenta outra liga ou bookmaker.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Liga", "Jogo", "Data", "Bookmaker", "1 Casa", "X Empate", "2 Fora"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: h.startsWith("1") || h.startsWith("X") || h.startsWith("2") ? "center" : "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((game) => {
                const bestH = Math.max(...game.bookmakers.map((b) => b.home));
                const bestD = Math.max(...game.bookmakers.map((b) => b.draw));
                const bestA = Math.max(...game.bookmakers.map((b) => b.away));

                return game.bookmakers.map((bm, idx) => (
                  <tr
                    key={`${game.id}-${bm.key}`}
                    style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafafa" }}
                  >
                    {idx === 0 && (
                      <>
                        <td rowSpan={game.bookmakers.length} style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 16 }}>{game.league_flag}</span>{" "}
                          <span style={{ color: "#64748b", fontSize: 12 }}>{game.league_name}</span>
                        </td>
                        <td rowSpan={game.bookmakers.length} style={{ padding: "10px 12px", fontWeight: 500 }}>
                          {game.home_team} <span style={{ color: "#94a3b8", fontWeight: 400 }}>vs</span> {game.away_team}
                        </td>
                        <td rowSpan={game.bookmakers.length} style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                          {formatDate(game.commence_time)}
                        </td>
                      </>
                    )}
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{bm.name}</td>

                    {(["home", "draw", "away"] as const).map((field) => {
                      const val = bm[field];
                      const isBest = val === (field === "home" ? bestH : field === "draw" ? bestD : bestA) && val > 0;
                      return (
                        <td key={field} style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: 8,
                            fontWeight: 600,
                            fontSize: 13,
                            background: val === 0 ? "#f1f5f9" : isBest ? "#dcfce7" : field === "home" ? "#eff6ff" : field === "draw" ? "#f8fafc" : "#fff7ed",
                            color: val === 0 ? "#94a3b8" : isBest ? "#15803d" : field === "home" ? "#1d4ed8" : field === "draw" ? "#475569" : "#c2410c",
                          }}>
                            {val > 0 ? val.toFixed(2) : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}