from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx
from typing import Optional
import os
import logging
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

THE_ODDS_API_BASE = "https://api.the-odds-api.com/v4"
ODDS_API_KEY = os.getenv("ODDS_API_KEY")

if not ODDS_API_KEY:
    raise ValueError("A variável ODDS_API_KEY não foi configurada no arquivo .env")

LEAGUES = {
    "soccer_england_premier_league":  {"name": "Premier League",   "country": "England",    "flag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    "soccer_spain_la_liga":           {"name": "La Liga",          "country": "Spain",       "flag": "🇪🇸"},
    "soccer_italy_serie_a":           {"name": "Serie A",          "country": "Italy",       "flag": "🇮🇹"},
    "soccer_germany_bundesliga":      {"name": "Bundesliga",       "country": "Germany",     "flag": "🇩🇪"},
    "soccer_france_ligue_one":        {"name": "Ligue 1",          "country": "France",      "flag": "🇫🇷"},
    "soccer_portugal_primeira_liga":  {"name": "Primeira Liga",    "country": "Portugal",    "flag": "🇵🇹"},
    "soccer_uefa_champs_league":      {"name": "Champions League", "country": "Europe",      "flag": "🏆"},
    "soccer_uefa_europa_league":      {"name": "Europa League",    "country": "Europe",      "flag": "🥈"},
    "soccer_uefa_nations_league":     {"name": "Nations League",   "country": "Europe",      "flag": "🌍"},
    "soccer_usa_mls":                 {"name": "MLS",              "country": "USA",         "flag": "🇺🇸"},
    "soccer_brazil_campeonato":       {"name": "Brasileirão",      "country": "Brazil",      "flag": "🇧🇷"},
    "soccer_argentina_primera_div":   {"name": "Primera División", "country": "Argentina",   "flag": "🇦🇷"},
    "soccer_conmebol_copa_america":   {"name": "Copa América",     "country": "S. America",  "flag": "🌎"},
    "soccer_fifa_world_cup":          {"name": "World Cup",        "country": "World",       "flag": "🌐"},
    "soccer_turkey_super_lig":        {"name": "Süper Lig",        "country": "Turkey",      "flag": "🇹🇷"},
    "soccer_netherlands_eredivisie":  {"name": "Eredivisie",       "country": "Netherlands", "flag": "🇳🇱"},
    "soccer_australia_aleague":       {"name": "A-League",         "country": "Australia",   "flag": "🇦🇺"},
    "soccer_japan_j_league":          {"name": "J-League",         "country": "Japan",       "flag": "🇯🇵"},
    "soccer_mexico_ligamx":           {"name": "Liga MX",          "country": "Mexico",      "flag": "🇲🇽"},
}


@app.get("/")
def serve_index():
    return FileResponse("index.html")


@app.get("/api/odds/{league_key}")
async def get_odds(league_key: str, bookmakers: Optional[str] = Query(None)):
    if league_key not in LEAGUES and league_key != "all":
        raise HTTPException(status_code=400, detail="Liga não suportada")

    keys_to_fetch = list(LEAGUES.keys()) if league_key == "all" else [league_key]
    results = []

    async with httpx.AsyncClient(timeout=20) as client:
        for key in keys_to_fetch:
            params = {
                "apiKey": ODDS_API_KEY,
                "regions": "eu",
                "markets": "h2h",
                "oddsFormat": "decimal",
            }
            try:
                resp = await client.get(f"{THE_ODDS_API_BASE}/sports/{key}/odds/", params=params)
            except Exception as e:
                logger.warning(f"Request failed for {key}: {e}")
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
                continue

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

    logger.info(f"Total jogos encontrados: {len(results)}")
    return results


@app.get("/api/bookmakers")
async def get_bookmakers():
    seen: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=15) as client:
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
            raise HTTPException(status_code=401, detail="API key inválida")
        if resp.status_code != 200:
            return []
        for game in resp.json():
            for bm in game.get("bookmakers", []):
                if bm["key"] not in seen:
                    seen[bm["key"]] = bm["title"]

    return [{"key": k, "name": v} for k, v in sorted(seen.items(), key=lambda x: x[1])]


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)