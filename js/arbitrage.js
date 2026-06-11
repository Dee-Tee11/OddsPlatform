/**
 * OddsDash - Arbitrage Panel Module
 * Arbitrage calculators and surebet scanner
 */

function initArbitragePanel() {
  const panel = document.getElementById("panel-arbitrage");
  if (panel.innerHTML) return;

  panel.innerHTML = `
    <div style="margin-bottom:1.25rem">
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:4px">⚖️ Calculadora de Arbitragem</h2>
      <p style="color:var(--muted);font-size:13px">Identifica e calcula apostas de surebet em diferentes casas para lucro garantido.</p>
    </div>
    <div class="calc-wrap">
      <!-- Arbitrage 2-way -->
      <div class="calc-card">
        <h3>Arbitragem 2 resultados</h3>
        <div class="calc-desc">Ex: Over/Under, ambas as equipas a marcar, etc.</div>

        <div class="calc-field">
          <label class="calc-label">Total a apostar (€)</label>
          <input class="calc-input" id="a2-total" type="number" placeholder="ex: 200" min="0" step="1" value="200">
        </div>
        <div class="calc-row">
          <div class="calc-field">
            <label class="calc-label">Odd 1 (casa A)</label>
            <input class="calc-input" id="a2-o1" type="number" placeholder="ex: 2.10" min="1" step="0.01" value="2.10">
          </div>
          <div class="calc-field">
            <label class="calc-label">Odd 2 (casa B)</label>
            <input class="calc-input" id="a2-o2" type="number" placeholder="ex: 2.05" min="1" step="0.01" value="2.05">
          </div>
        </div>

        <div class="calc-result" id="a2-result">
          <div class="calc-result-title">Resultado</div>
          <div id="a2-output"></div>
        </div>
      </div>

      <!-- Arbitrage 3-way -->
      <div class="calc-card">
        <h3>Arbitragem 3 resultados (1X2)</h3>
        <div class="calc-desc">Futebol: vitória casa · empate · vitória fora em 3 casas diferentes.</div>

        <div class="calc-field">
          <label class="calc-label">Total a apostar (€)</label>
          <input class="calc-input" id="a3-total" type="number" placeholder="ex: 300" min="0" step="1" value="300">
        </div>
        <div class="calc-row3">
          <div class="calc-field">
            <label class="calc-label">Odd 1 (Casa)</label>
            <input class="calc-input" id="a3-o1" type="number" placeholder="2.20" min="1" step="0.01" value="2.20">
          </div>
          <div class="calc-field">
            <label class="calc-label">Odd X (Empate)</label>
            <input class="calc-input" id="a3-ox" type="number" placeholder="3.50" min="1" step="0.01" value="3.50">
          </div>
          <div class="calc-field">
            <label class="calc-label">Odd 2 (Fora)</label>
            <input class="calc-input" id="a3-o2" type="number" placeholder="3.80" min="1" step="0.01" value="3.80">
          </div>
        </div>
        <div class="calc-row3" style="margin-top:-4px">
          <div class="calc-field">
            <label class="calc-label">Casa (bookmaker)</label>
            <input class="calc-input" id="a3-b1" type="text" placeholder="Betano" value="Casa A">
          </div>
          <div class="calc-field">
            <label class="calc-label">Casa empate</label>
            <input class="calc-input" id="a3-bx" type="text" placeholder="bet365" value="Casa B">
          </div>
          <div class="calc-field">
            <label class="calc-label">Casa fora</label>
            <input class="calc-input" id="a3-b2" type="text" placeholder="Unibet" value="Casa C">
          </div>
        </div>

        <div class="calc-result" id="a3-result">
          <div class="calc-result-title">Resultado</div>
          <div id="a3-output"></div>
        </div>
      </div>
    </div>

    <!-- Live arb scanner from current odds -->
    <div class="calc-card" style="margin-top:1.5rem">
      <h3>🔍 Scanner de Arbitragem — Dados Actuais</h3>
      <div class="calc-desc">Detecta automaticamente surebets nos jogos carregados. Atualiza com o botão acima.</div>
      <div id="arb-scanner-output"></div>
    </div>
  `;

  setupArbitrageEvents();
  calcArb2();
  calcArb3();
  refreshArbScanner();
}

function setupArbitrageEvents() {
  ["a2-total", "a2-o1", "a2-o2"].forEach(id => {
    document.getElementById(id).addEventListener("input", calcArb2);
  });
  ["a3-total", "a3-o1", "a3-ox", "a3-o2", "a3-b1", "a3-bx", "a3-b2"].forEach(id => {
    document.getElementById(id).addEventListener("input", calcArb3);
  });
}

function calcArb2() {
  const total = parseFloat(document.getElementById("a2-total").value) || 0;
  const o1 = parseFloat(document.getElementById("a2-o1").value) || 0;
  const o2 = parseFloat(document.getElementById("a2-o2").value) || 0;
  const out = document.getElementById("a2-output");

  if (!total || !o1 || !o2) {
    out.innerHTML = `<div style="color:var(--muted);font-size:12px">Preenche todos os campos.</div>`;
    return;
  }

  const margin = 1 / o1 + 1 / o2;
  const isArb = margin < 1;
  const profit = isArb ? (1 / margin - 1) * 100 : null;

  const s1 = total / (o1 * margin);
  const s2 = total / (o2 * margin);

  out.innerHTML = `
    <div class="calc-result-grid" style="margin-bottom:8px">
      <div class="calc-result-item"><div class="label">Aposta 1</div><div class="value value-blue">${curr(s1)}</div></div>
      <div class="calc-result-item"><div class="label">Aposta 2</div><div class="value value-blue">${curr(s2)}</div></div>
      <div class="calc-result-item"><div class="label">Margem total</div><div class="value ${isArb ? "value-green" : "value-red"}">${(margin * 100).toFixed(2)}%</div></div>
      <div class="calc-result-item"><div class="label">${isArb ? "Lucro garantido" : "Sem arbitragem"}</div><div class="value ${isArb ? "value-green" : "value-red"}">${isArb ? "+" + profit.toFixed(2) + "%" : "Margem > 100%"}</div></div>
    </div>
    ${
      isArb
        ? `<div class="arb-opportunity"><div class="arb-text">Surebet! +${profit.toFixed(2)}% de lucro garantido (€${(total * (1 / margin - 1)).toFixed(2)})</div></div>`
        : `<div class="no-arb">Não há arbitragem. A margem das casas é ${((margin - 1) * 100).toFixed(2)}% acima de 100%.</div>`
    }`;
}

function calcArb3() {
  const total = parseFloat(document.getElementById("a3-total").value) || 0;
  const o1 = parseFloat(document.getElementById("a3-o1").value) || 0;
  const ox = parseFloat(document.getElementById("a3-ox").value) || 0;
  const o2 = parseFloat(document.getElementById("a3-o2").value) || 0;
  const b1 = document.getElementById("a3-b1").value || "Casa A";
  const bx = document.getElementById("a3-bx").value || "Casa B";
  const b2 = document.getElementById("a3-b2").value || "Casa C";
  const out = document.getElementById("a3-output");

  if (!total || !o1 || !ox || !o2) {
    out.innerHTML = `<div style="color:var(--muted);font-size:12px">Preenche todos os campos.</div>`;
    return;
  }

  const margin = 1 / o1 + 1 / ox + 1 / o2;
  const isArb = margin < 1;
  const profit = isArb ? (1 / margin - 1) * 100 : null;

  const s1 = total / (o1 * margin);
  const sx = total / (ox * margin);
  const s2 = total / (o2 * margin);

  const guaranteedReturn = s1 * o1;

  out.innerHTML = `
    <div class="calc-result-grid" style="margin-bottom:8px">
      <div class="calc-result-item"><div class="label">€ em 1 (${b1})</div><div class="value value-blue">${curr(s1)}</div></div>
      <div class="calc-result-item"><div class="label">€ em X (${bx})</div><div class="value">${curr(sx)}</div></div>
      <div class="calc-result-item"><div class="label">€ em 2 (${b2})</div><div class="value value-amber">${curr(s2)}</div></div>
      <div class="calc-result-item"><div class="label">Margem total</div><div class="value ${isArb ? "value-green" : "value-red"}">${(margin * 100).toFixed(2)}%</div></div>
    </div>
    ${
      isArb
        ? `<div class="arb-opportunity">
          <div>
            <div class="arb-text">Surebet! +${profit.toFixed(2)}% de lucro garantido</div>
            <div style="font-size:12px;color:var(--green);margin-top:2px">Retorno garantido: €${guaranteedReturn.toFixed(2)} (lucro: €${(guaranteedReturn - total).toFixed(2)})</div>
          </div>
        </div>`
        : `<div class="no-arb">Não há arbitragem. Margem combinada: ${(margin * 100).toFixed(2)}%. Precisas de uma margem abaixo de 100%.</div>`
    }`;
}

function refreshArbScanner() {
  if (!document.getElementById("arb-scanner-output")) return;

  const el = document.getElementById("arb-scanner-output");
  if (!AppState.games.length) return;

  const surebets = [];

  AppState.games.forEach(g => {
    if (g.bookmakers.length < 2) return;

    const bms = g.bookmakers;
    let bestH = { val: 0, name: "" },
      bestD = { val: 0, name: "" },
      bestA = { val: 0, name: "" };

    bms.forEach(b => {
      if (b.home > bestH.val) bestH = { val: b.home, name: b.name };
      if (b.draw > bestD.val) bestD = { val: b.draw, name: b.name };
      if (b.away > bestA.val) bestA = { val: b.away, name: b.name };
    });

    if (bestH.val <= 0 || bestD.val <= 0 || bestA.val <= 0) return;

    const margin = 1 / bestH.val + 1 / bestD.val + 1 / bestA.val;

    if (margin < 1) {
      const profitPct = (1 / margin - 1) * 100;
      surebets.push({ game: g, margin, profitPct, bestH, bestD, bestA });
    }
  });

  if (!surebets.length) {
    el.innerHTML = `<div class="no-arb">
      Nenhuma oportunidade de arbitragem detectada nos dados actuais.
      A maioria dos bookmakers europeus tem margens de 4–8%, tornando surebets raras.
      <br><br><span style="color:var(--subtle)">Dica: carrega mais ligas ou usa mais bookmakers para aumentar as hipóteses.</span>
    </div>`;
    return;
  }

  el.innerHTML = surebets
    .map(sb => {
      const total = 1000;
      const s1 = (total * (1 / sb.bestH.val)) / sb.margin;
      const sx = (total * (1 / sb.bestD.val)) / sb.margin;
      const s2 = (total * (1 / sb.bestA.val)) / sb.margin;
      const guaranteedReturn = total / sb.margin;
      const guaranteedProfit = guaranteedReturn - total;

      return `
        <div class="arb-opportunity" style="flex-direction:column;align-items:flex-start">
          <div style="display:flex;align-items:center;gap:10px;width:100%">
            <div style="flex:1">
              <div style="font-weight:700;color:var(--text)">${sb.game.home_team} vs ${sb.game.away_team}</div>
              <div style="font-size:12px;color:var(--muted)">${sb.game.league_name} · ${fmt(sb.game.commence_time)}</div>
            </div>
            <div style="text-align:right">
              <div class="arb-text">+${sb.profitPct.toFixed(2)}% lucro</div>
              <div style="font-size:11px;color:var(--muted)">Margem: ${(sb.margin * 100).toFixed(2)}%</div>
            </div>
          </div>
          <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap;font-size:12px">
            <div><span style="color:var(--muted)">1 Casa:</span> <strong style="color:var(--blue)">${sb.bestH.val.toFixed(2)}</strong> @ ${sb.bestH.name} — apostar €${s1.toFixed(2)}</div>
            <div><span style="color:var(--muted)">X Empate:</span> <strong style="color:var(--text)">${sb.bestD.val.toFixed(2)}</strong> @ ${sb.bestD.name} — apostar €${sx.toFixed(2)}</div>
            <div><span style="color:var(--muted)">2 Fora:</span> <strong style="color:var(--amber)">${sb.bestA.val.toFixed(2)}</strong> @ ${sb.bestA.name} — apostar €${s2.toFixed(2)}</div>
            <div style="color:var(--green);font-weight:700">✅ Lucro garantido (€1000): €${guaranteedProfit.toFixed(2)}</div>
          </div>
        </div>`;
    })
    .join("");
}
