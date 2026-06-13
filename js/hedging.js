/**
 * OddsDash - Hedging Panel Module
 * Calculators for hedging strategies and lay betting
 */

function initHedgingPanel() {
  const panel = document.getElementById("panel-hedging");
  if (panel.innerHTML) return;

  panel.innerHTML = `
    <div style="margin-bottom:1.25rem">
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:4px">🛡️ Calculadora de Hedging</h2>
      <p style="color:var(--muted);font-size:13px">Calcula quanto apostar na direção oposta para garantir lucro ou minimizar perdas.</p>
    </div>
    <div class="calc-wrap">
      <!-- Hedge calc -->
      <div class="calc-card">
        <h3>Hedge Simples</h3>
        <div class="calc-desc">Aposta original + aposta de cobertura num resultado oposto.</div>

        <div class="calc-field">
          <label class="calc-label">Aposta original (€)</label>
          <input class="calc-input" id="h-stake" type="number" placeholder="ex: 100" min="0" step="0.01" value="100">
        </div>
        <div class="calc-row">
          <div class="calc-field">
            <label class="calc-label">Odd original</label>
            <input class="calc-input" id="h-odds-orig" type="number" placeholder="ex: 3.50" min="1" step="0.01" value="3.50">
          </div>
          <div class="calc-field">
            <label class="calc-label">Odd de hedge</label>
            <input class="calc-input" id="h-odds-hedge" type="number" placeholder="ex: 2.10" min="1" step="0.01" value="2.10">
          </div>
        </div>

        <div class="calc-field">
          <label class="calc-label">Tipo de hedge</label>
          <select class="calc-input" id="h-mode">
            <option value="guaranteed">Lucro garantido (igual nos 2 cenários)</option>
            <option value="breakeven">Break-even (sem perdas)</option>
            <option value="partial">Parcial — % de cobertura</option>
          </select>
        </div>

        <div class="calc-field" id="h-pct-wrap" style="display:none">
          <label class="calc-label">Cobertura (%)</label>
          <input class="calc-input" id="h-pct" type="number" placeholder="ex: 50" min="1" max="100" value="50">
        </div>

        <div class="calc-result" id="h-result">
          <div class="calc-result-title">Resultado</div>
          <div class="calc-result-grid" id="h-grid"></div>
        </div>
      </div>

      <!-- Lay bet (exchange) -->
      <div class="calc-card">
        <h3>Lay Bet (Exchange)</h3>
        <div class="calc-desc">Calcular aposta lay numa exchange (Betfair) para cobrir aposta back.</div>

        <div class="calc-field">
          <label class="calc-label">Aposta Back (€)</label>
          <input class="calc-input" id="l-back-stake" type="number" placeholder="ex: 50" min="0" step="0.01" value="50">
        </div>
        <div class="calc-row">
          <div class="calc-field">
            <label class="calc-label">Odd Back</label>
            <input class="calc-input" id="l-back-odds" type="number" placeholder="ex: 4.00" min="1" step="0.01" value="4.00">
          </div>
          <div class="calc-field">
            <label class="calc-label">Odd Lay</label>
            <input class="calc-input" id="l-lay-odds" type="number" placeholder="ex: 4.20" min="1" step="0.01" value="4.20">
          </div>
        </div>
        <div class="calc-field">
          <label class="calc-label">Comissão Exchange (%)</label>
          <input class="calc-input" id="l-commission" type="number" placeholder="ex: 5" min="0" max="20" step="0.1" value="5">
        </div>

        <div class="calc-result" id="l-result">
          <div class="calc-result-title">Resultado</div>
          <div class="calc-result-grid" id="l-grid"></div>
        </div>
      </div>
    </div>
  `;

  setupHedgingEvents();
  calcHedge();
  calcLay();
}

function setupHedgingEvents() {
  document.getElementById("h-mode").addEventListener("change", e => {
    document.getElementById("h-pct-wrap").style.display = e.target.value === "partial" ? "" : "none";
    calcHedge();
  });

  ["h-stake", "h-odds-orig", "h-odds-hedge", "h-pct"].forEach(id => {
    document.getElementById(id).addEventListener("input", calcHedge);
  });

  ["l-back-stake", "l-back-odds", "l-lay-odds", "l-commission"].forEach(id => {
    document.getElementById(id).addEventListener("input", calcLay);
  });
}

function calcHedge() {
  const stake = parseFloat(document.getElementById("h-stake").value) || 0;
  const origOdd = parseFloat(document.getElementById("h-odds-orig").value) || 0;
  const hedgeOdd = parseFloat(document.getElementById("h-odds-hedge").value) || 0;
  const mode = document.getElementById("h-mode").value;
  const pctVal = parseFloat(document.getElementById("h-pct").value) || 50;

  const grid = document.getElementById("h-grid");
  if (!stake || !origOdd || !hedgeOdd) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:12px;grid-column:1/-1">Preenche todos os campos.</div>`;
    return;
  }

  const originalReturn = stake * origOdd;
  const originalProfit = originalReturn - stake;

  let hedgeStake;
  if (mode === "guaranteed") {
    hedgeStake = (stake * origOdd) / hedgeOdd;
  } else if (mode === "breakeven") {
    hedgeStake = stake / hedgeOdd;
  } else {
    hedgeStake = (stake * origOdd * (pctVal / 100)) / hedgeOdd;
  }

  const hedgeReturn = hedgeStake * hedgeOdd;
  const totalStaked = stake + hedgeStake;

  const profitIfOrig = originalReturn - totalStaked;
  const profitIfHedge = hedgeReturn - totalStaked;

  const minProfit = Math.min(profitIfOrig, profitIfHedge);

  grid.innerHTML = `
    <div class="calc-result-item"><div class="label">Aposta Hedge</div><div class="value value-blue">${curr(hedgeStake)}</div></div>
    <div class="calc-result-item"><div class="label">Total apostado</div><div class="value">${curr(totalStaked)}</div></div>
    <div class="calc-result-item"><div class="label">Lucro se original</div><div class="value ${profitIfOrig >= 0 ? "value-green" : "value-red"}">${curr(profitIfOrig)}</div></div>
    <div class="calc-result-item"><div class="label">Lucro se hedge</div><div class="value ${profitIfHedge >= 0 ? "value-green" : "value-red"}">${curr(profitIfHedge)}</div></div>
    <div class="calc-result-item"><div class="label">Lucro mínimo</div><div class="value ${minProfit >= 0 ? "value-green" : "value-red"}">${curr(minProfit)}</div></div>
    <div class="calc-result-item"><div class="label">ROI</div><div class="value value-amber">${totalStaked > 0 ? ((minProfit / totalStaked) * 100).toFixed(1) : "0"}%</div></div>`;
}

function calcLay() {
  const backStake = parseFloat(document.getElementById("l-back-stake").value) || 0;
  const backOdds = parseFloat(document.getElementById("l-back-odds").value) || 0;
  const layOdds = parseFloat(document.getElementById("l-lay-odds").value) || 0;
  const commission = (parseFloat(document.getElementById("l-commission").value) || 0) / 100;

  const grid = document.getElementById("l-grid");
  if (!backStake || !backOdds || !layOdds) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:12px;grid-column:1/-1">Preenche todos os campos.</div>`;
    return;
  }

  const layStake = (backStake * backOdds) / (layOdds - commission);
  const layLiability = layStake * (layOdds - 1);

  const backWinProfit = backStake * (backOdds - 1) - layStake * (layOdds - 1);
  const backLoseProfit = layStake * (1 - commission) - backStake;

  grid.innerHTML = `
    <div class="calc-result-item"><div class="label">Aposta Lay</div><div class="value value-blue">${curr(layStake)}</div></div>
    <div class="calc-result-item"><div class="label">Responsabilidade Lay</div><div class="value value-amber">${curr(layLiability)}</div></div>
    <div class="calc-result-item"><div class="label">Se Back ganha</div><div class="value ${backWinProfit >= 0 ? "value-green" : "value-red"}">${curr(backWinProfit)}</div></div>
    <div class="calc-result-item"><div class="label">Se Back perde</div><div class="value ${backLoseProfit >= 0 ? "value-green" : "value-red"}">${curr(backLoseProfit)}</div></div>
    <div class="calc-result-item"><div class="label">Diferença</div><div class="value">${curr(Math.abs(backWinProfit - backLoseProfit))}</div></div>
    <div class="calc-result-item"><div class="label">Comissão paga</div><div class="value">${curr(layStake * commission)}</div></div>`;
}
