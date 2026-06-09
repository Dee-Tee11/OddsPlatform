from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from typing import Optional
import os
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente do arquivo .env
load_dotenv()

app = FastAPI(title="Odds Platform API")

# Add middleware to log all requests
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"REQUEST: {request.method} {request.url.path} - Query: {dict(request.query_params)}")
    response = await call_next(request)
    logger.info(f"RESPONSE: {response.status_code}")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

THE_ODDS_API_BASE = "https://api.the-odds-api.com/v4"
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

if not ODDS_API_KEY:
    raise ValueError("A variável ODDS_API_KEY não foi configurada no arquivo .env")

LEAGUES = {
    "soccer_england_premier_league": {"name": "Premier League", "country": "England", "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    "soccer_spain_la_liga":          {"name": "La Liga",         "country": "Spain",   "flag": "🇪🇸"},
    "soccer_italy_serie_a":          {"name": "Serie A",         "country": "Italy",   "flag": "🇮🇹"},
    "soccer_germany_bundesliga":     {"name": "Bundesliga",      "country": "Germany", "flag": "🇩🇪"},
    "soccer_france_ligue_one":       {"name": "Ligue 1",         "country": "France",  "flag": "🇫🇷"},
    "soccer_portugal_primeira_liga": {"name": "Primeira Liga",   "country": "Portugal","flag": "🇵🇹"},
}


@app.get("/api/leagues")
def get_leagues():
    """Return the list of supported leagues."""
    logger.debug(f"GET /api/leagues called")
    return [{"key": k, **v} for k, v in LEAGUES.items()]


@app.get("/api/odds/{league_key}")
async def get_odds(
    league_key: str,
    bookmakers: Optional[str] = Query(None, description="Comma-separated bookmaker keys to filter"),
):
    logger.info(f"Received request for league: {league_key}, bookmakers: {bookmakers}")
    if league_key not in LEAGUES and league_key != "all":
        raise HTTPException(status_code=400, detail="Liga não suportada")

    keys_to_fetch = list(LEAGUES.keys()) if league_key == "all" else [league_key]
    results = []

    async with httpx.AsyncClient(timeout=15) as client:
        for key in keys_to_fetch:
            url = f"{THE_ODDS_API_BASE}/sports/{key}/odds/"
            params = {
                "apiKey": ODDS_API_KEY,
                "regions": "eu",
                "markets": "h2h",
                "oddsFormat": "decimal",
            }
            resp = await client.get(url, params=params)

            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="API key inválida")
            if resp.status_code in (404, 422):
                logger.warning(f"Sport key {key} not available: {resp.status_code}")
                continue  # skip league on 404 or 422 errors
            if resp.status_code != 200:
                logger.warning(f"Failed to fetch {key}: {resp.status_code}")
                continue  # skip league on other errors

            data = resp.json()
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
                    bm_list.append({
                        "key": bm["key"],
                        "name": bm["title"],
                        "home": outcomes.get(game["home_team"], 0),
                        "draw": outcomes.get("Draw", 0),
                        "away": outcomes.get(game["away_team"], 0),
                        "last_update": bm.get("last_update"),
                    })

                if bm_list:
                    results.append({
                        "id": game["id"],
                        "league_key": key,
                        "league_name": league_info["name"],
                        "league_flag": league_info["flag"],
                        "home_team": game["home_team"],
                        "away_team": game["away_team"],
                        "commence_time": game["commence_time"],
                        "bookmakers": bm_list,
                    })

    return results


@app.get("/api/bookmakers")
async def get_available_bookmakers():
    """List EU bookmakers available for a given API key."""
    seen = {}
    
    async with httpx.AsyncClient(timeout=10) as client:
        # Use 'upcoming' to get games across all sports
        resp = await client.get(
            f"{THE_ODDS_API_BASE}/sports/upcoming/odds/",
            params={"apiKey": ODDS_API_KEY, "regions": "eu", "markets": "h2h", "oddsFormat": "decimal"},
        )
        
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail="API key inválida")
        elif resp.status_code != 200:
            logger.error(f"Failed to fetch upcoming odds: {resp.status_code}")
            return []
        
        data = resp.json()
        for game in data:
            for bm in game.get("bookmakers", []):
                if bm["key"] not in seen:
                    seen[bm["key"]] = bm["title"]
    
    if not seen:
        logger.warning("No bookmakers found")
        return []
    
    return [{"key": k, "name": v} for k, v in sorted(seen.items(), key=lambda x: x[1])]