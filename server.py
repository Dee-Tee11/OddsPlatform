from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import httpx
from typing import Optional
import os
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# ── CORS Configuration ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

THE_ODDS_API_BASE = "https://api.the-odds-api.com/v4"
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

if not ODDS_API_KEY:
    logger.warning("⚠️  ODDS_API_KEY não configurada! Alguns endpoints podem não funcionar.")
    # Don't raise, let it continue - so we get better error messages

# ── Odds history storage ──────────────────────────────────────────────────────
# Try to use file, but fallback to memory cache if filesystem is not writable
HISTORY_FILE = Path("odds_history.json")
HISTORY_MEMORY_CACHE = {}  # Fallback cache for Render's ephemeral filesystem
HISTORY_USE_FILE = False  # Will be set to True if file write succeeds

def load_history() -> dict:
    # Try file first if available
    if HISTORY_FILE.exists():
        try:
            data = json.loads(HISTORY_FILE.read_text())
            logger.info("📂 History loaded from file")
            return data
        except Exception as e:
            logger.warning(f"⚠️  Failed to read history file: {e}")
            return HISTORY_MEMORY_CACHE
    
    # Return memory cache
    return HISTORY_MEMORY_CACHE.copy()

def save_history(h: dict):
    global HISTORY_USE_FILE
    
    # Try to save to file
    try:
        HISTORY_FILE.write_text(json.dumps(h))
        HISTORY_USE_FILE = True
        logger.debug("💾 History saved to file")
    except Exception as e:
        logger.warning(f"⚠️  Could not write to file ({e}), using memory cache only")
        HISTORY_USE_FILE = False
        # Keep in memory
        HISTORY_MEMORY_CACHE.update(h)

def record_odds(game_id: str, bm_key: str, home: float, draw: float, away: float):
    try:
        h = load_history()
        key = f"{game_id}::{bm_key}"
        if key not in h:
            h[key] = []
        now = datetime.now(timezone.utc).isoformat()
        h[key].append({"ts": now, "home": home, "draw": draw, "away": away})
        # keep last 48 entries per game+bookmaker
        h[key] = h[key][-48:]
        save_history(h)
    except Exception as e:
        logger.warning(f"⚠️  Could not record odds: {e}")

def get_history_for_game(game_id: str) -> dict:
    h = load_history()
    result = {}
    prefix = f"{game_id}::"
    for k, v in h.items():
        if k.startswith(prefix):
            bm_key = k[len(prefix):]
            result[bm_key] = v
    return result

# ── League config ─────────────────────────────────────────────────────────────
LEAGUES = {
    "soccer_england_premier_league":  {"name": "Premier League",   "country": "England",    "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "tier": 1},
    "soccer_spain_la_liga":           {"name": "La Liga",          "country": "Spain",       "flag": "🇪🇸", "tier": 1},
    "soccer_italy_serie_a":           {"name": "Serie A",          "country": "Italy",       "flag": "🇮🇹", "tier": 1},
    "soccer_germany_bundesliga":      {"name": "Bundesliga",       "country": "Germany",     "flag": "🇩🇪", "tier": 1},
    "soccer_france_ligue_one":        {"name": "Ligue 1",          "country": "France",      "flag": "🇫🇷", "tier": 1},
    "soccer_portugal_primeira_liga":  {"name": "Primeira Liga",    "country": "Portugal",    "flag": "🇵🇹", "tier": 1},
    "soccer_uefa_champs_league":      {"name": "Champions League", "country": "Europe",      "flag": "🏆", "tier": 1},
    "soccer_uefa_europa_league":      {"name": "Europa League",    "country": "Europe",      "flag": "🥈", "tier": 2},
    "soccer_uefa_nations_league":     {"name": "Nations League",   "country": "Europe",      "flag": "🌍", "tier": 2},
    "soccer_usa_mls":                 {"name": "MLS",              "country": "USA",         "flag": "🇺🇸", "tier": 2},
    "soccer_brazil_campeonato":       {"name": "Brasileirão",      "country": "Brazil",      "flag": "🇧🇷", "tier": 2},
    "soccer_argentina_primera_div":   {"name": "Primera División", "country": "Argentina",   "flag": "🇦🇷", "tier": 2},
    "soccer_conmebol_copa_america":   {"name": "Copa América",     "country": "S. America",  "flag": "🌎", "tier": 2},
    "soccer_fifa_world_cup":          {"name": "World Cup",        "country": "World",       "flag": "🌐", "tier": 1},
    "soccer_turkey_super_lig":        {"name": "Süper Lig",        "country": "Turkey",      "flag": "🇹🇷", "tier": 2},
    "soccer_netherlands_eredivisie":  {"name": "Eredivisie",       "country": "Netherlands", "flag": "🇳🇱", "tier": 2},
    "soccer_australia_aleague":       {"name": "A-League",         "country": "Australia",   "flag": "🇦🇺", "tier": 3},
    "soccer_japan_j_league":          {"name": "J-League",         "country": "Japan",       "flag": "🇯🇵", "tier": 3},
    "soccer_mexico_ligamx":           {"name": "Liga MX",          "country": "Mexico",      "flag": "🇲🇽", "tier": 2},
}

TOP_LEAGUES = [k for k, v in LEAGUES.items() if v["tier"] == 1]

# ── ELO ratings fetcher ───────────────────────────────────────────────────────
ELO_CACHE = {"data": {}, "ts": 0}
ELO_TTL = 3600  # 1h

async def fetch_elo_ratings() -> dict:
    now = time.time()
    if now - ELO_CACHE["ts"] < ELO_TTL and ELO_CACHE["data"]:
        return ELO_CACHE["data"]

    ratings = {}
    urls = [
        "https://api.clubelo.com/today",  # Changed to HTTPS
    ]
    async with httpx.AsyncClient(timeout=20, verify=False) as client:  # Increased timeout to 20s
        for url in urls:
            try:
                r = await client.get(url)
                if r.status_code == 200:
                    lines = r.text.strip().split("\n")
                    for line in lines[1:]:  # skip header
                        parts = line.split(",")
                        if len(parts) >= 5:
                            club = parts[1].strip()
                            elo = float(parts[4].strip())
                            ratings[club.lower()] = elo
                    break
            except Exception as e:
                logger.warning(f"🔴 ELO fetch failed: {e}")

    ELO_CACHE["data"] = ratings
    ELO_CACHE["ts"] = now
    return ratings

def elo_win_prob(elo_home: float, elo_away: float, home_advantage: float = 100) -> tuple:
    """Return (p_home, p_draw, p_away) based on ELO difference."""
    diff = elo_home + home_advantage - elo_away
    # Bradley-Terry model for win/loss
    p_home_no_draw = 1 / (1 + 10 ** (-diff / 400))
    p_away_no_draw = 1 - p_home_no_draw

    # Approximate draw probability using Dixon-Coles-style constant
    # draw probability peaks around equal teams
    max_draw = 0.28
    draw_factor = max_draw * (1 - abs(p_home_no_draw - 0.5) * 2.2)
    draw_factor = max(0.05, min(draw_factor, max_draw))

    p_home = p_home_no_draw * (1 - draw_factor)
    p_away = p_away_no_draw * (1 - draw_factor)
    p_draw = draw_factor

    # normalize
    total = p_home + p_draw + p_away
    return (round(p_home / total, 4), round(p_draw / total, 4), round(p_away / total, 4))

def fuzzy_match(team: str, ratings: dict) -> Optional[float]:
    """Try to find ELO rating with fuzzy name matching."""
    team_lower = team.lower()
    # exact
    if team_lower in ratings:
        return ratings[team_lower]
    # partial: team name contains key or key contains team name
    for k, v in ratings.items():
        if team_lower in k or k in team_lower:
            return v
    # word overlap
    team_words = set(team_lower.split())
    best_score = 0
    best_val = None
    for k, v in ratings.items():
        k_words = set(k.split())
        overlap = len(team_words & k_words)
        if overlap > best_score and overlap >= 1:
            best_score = overlap
            best_val = v
    return best_val

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def serve_index():
    return FileResponse("index.html")


@app.get("/api/health")
def health_check():
    """Health check endpoint - useful for debugging"""
    return {
        "status": "ok",
        "has_api_key": bool(ODDS_API_KEY),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/odds/{league_key}")
async def get_odds(league_key: str, bookmakers: Optional[str] = Query(None)):
    if league_key not in LEAGUES and league_key not in ("all", "top"):
        raise HTTPException(status_code=400, detail="Liga não suportada")

    if league_key == "top":
        keys_to_fetch = TOP_LEAGUES
    elif league_key == "all":
        keys_to_fetch = list(LEAGUES.keys())
    else:
        keys_to_fetch = [league_key]

    results = []
    elo_ratings = {}
    try:
        elo_ratings = await fetch_elo_ratings()
    except:
        pass

    async with httpx.AsyncClient(timeout=30, verify=False) as client:  # Increased timeout to 30s
        for key in keys_to_fetch:
            if not ODDS_API_KEY:
                logger.error(f"❌ ODDS_API_KEY não configurada! Não posso buscar {key}")
                continue
            params = {
                "apiKey": ODDS_API_KEY,
                "regions": "eu",
                "markets": "h2h",
                "oddsFormat": "decimal",
            }
            try:
                resp = await client.get(f"{THE_ODDS_API_BASE}/sports/{key}/odds/", params=params)
            except Exception as e:
                logger.error(f"🔴 Request failed for {key}: {e}")
                continue

            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="API key inválida")
            if resp.status_code in (404, 422):
                continue
            if resp.status_code != 200:
                logger.warning(f"Erro ao obter {key}: {resp.status_code}")
                continue

            data = resp.json()
            if not data:
                logger.warning(f"📭 {key}: Nenhum dado retornado pela API")
                continue

            logger.info(f"📊 {key}: {len(data)} jogos encontrados")

            league_info = LEAGUES[key]
            for game in data:
                bm_list = []
                for bm in game.get("bookmakers", []):
                    if bookmakers:
                        allowed = [b.strip() for b in bookmakers.split(",")]
                        if bm["key"] not in allowed:
                            continue
                    market = next((m for m in bm.get("markets", []) if m["key"] == "h2h"), None)
                    if not market:
                        continue
                    outcomes = {o["name"]: o["price"] for o in market["outcomes"]}
                    h = outcomes.get(game["home_team"], 0)
                    d = outcomes.get("Draw", 0)
                    a = outcomes.get(game["away_team"], 0)
                    bm_list.append({
                        "key": bm["key"],
                        "name": bm["title"],
                        "home": h,
                        "draw": d,
                        "away": a,
                        "last_update": bm.get("last_update"),
                    })
                    # record history
                    if h > 0 or d > 0 or a > 0:
                        try:
                            record_odds(game["id"], bm["key"], h, d, a)
                        except:
                            pass

                if bm_list:
                    # ELO value assessment
                    elo_home = fuzzy_match(game["home_team"], elo_ratings)
                    elo_away = fuzzy_match(game["away_team"], elo_ratings)
                    elo_probs = None
                    if elo_home and elo_away:
                        ph, pd, pa = elo_win_prob(elo_home, elo_away)
                        elo_probs = {
                            "home": ph, "draw": pd, "away": pa,
                            "elo_home": round(elo_home), "elo_away": round(elo_away)
                        }

                    results.append({
                        "id": game["id"],
                        "league_key": key,
                        "league_name": league_info["name"],
                        "league_flag": league_info["flag"],
                        "home_team": game["home_team"],
                        "away_team": game["away_team"],
                        "commence_time": game["commence_time"],
                        "bookmakers": bm_list,
                        "elo_probs": elo_probs,
                    })

    logger.info(f"🎯 Fetching odds for league(s): {keys_to_fetch}")
    logger.info(f"Total jogos encontrados: {len(results)}")
    if not results:
        logger.warning("⚠️  Nenhum jogo encontrado! Pode estar sem dados agora.")
    return results


@app.get("/api/odds-history/{game_id}")
async def get_odds_history(game_id: str):
    return get_history_for_game(game_id)


@app.get("/api/bookmakers")
async def get_bookmakers():
    seen: dict[str, str] = {}
    if not ODDS_API_KEY:
        logger.error("❌ ODDS_API_KEY não configurada!")
        return []
    
    async with httpx.AsyncClient(timeout=30, verify=False) as client:  # Increased timeout to 30s
        try:
            resp = await client.get(
                f"{THE_ODDS_API_BASE}/sports/upcoming/odds/",
                params={
                    "apiKey": ODDS_API_KEY,
                    "regions": "eu",
                    "markets": "h2h",
                    "oddsFormat": "decimal",
                },
            )
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="API key inválida ou expirada")
            if resp.status_code != 200:
                logger.warning(f"⚠️  Status {resp.status_code} ao buscar bookmakers")
                return []
            for game in resp.json():
                for bm in game.get("bookmakers", []):
                    if bm["key"] not in seen:
                        seen[bm["key"]] = bm["title"]
        except Exception as e:
            logger.error(f"🔴 Erro ao buscar bookmakers: {e}")
            return []

    return [{"key": k, "name": v} for k, v in sorted(seen.items(), key=lambda x: x[1])]


# Mount static files AFTER all API routes (so API routes take precedence)
app.mount("/", StaticFiles(directory=".", html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)