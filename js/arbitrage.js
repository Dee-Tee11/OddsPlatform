/**
 * OddsDash - Arbitrage Panel Module (v3)
 * Scanner reativo ao localStorage — sem polling, sem countdown.
 * Atualiza automaticamente sempre que os dados de odds mudam.
 */

// ── Estado da calculadora em linha ─────────────────────────────────────────
const ArbCalcState = {
  activeId:   null,  // game id com calculadora aberta
  totalInput: 1000,  // montante definido pelo utilizador
};

// ── Panel init ─────────────────────────────────────────────────────────────
function initArbitragePanel() {
  const panel = document.getElementById("panel-arbitrage");
  if (panel.innerHTML) return;

  panel.innerHTML = `
    <div style="margin-bottom:1.25rem">
      <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:4px">⚖️ Calculadora de Arbitragem</h2>
      <p style="color:var(--muted);font-size:13px">Identifica e calcula apostas de surebet em diferentes casas para lucro garantido.</p>
    </div>

    <div class="calc-wrap">
      <!-- 2-way -->
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

      <!-- 3-way -->
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
            <label class="calc-label">Casa (1)</label>
            <input class="calc-input" id="a3-b1" type="text" placeholder="Betano" value="Casa A">
          </div>
          <div class="calc-field">
            <label class="calc-label">Casa (X)</label>
            <input class="calc-input" id="a3-bx" type="text" placeholder="bet365" value="Casa B">
          </div>
          <div class="calc-field">
            <label class="calc-label">Casa (2)</label>
            <input class="calc-input" id="a3-b2" type="text" placeholder="Unibet" value="Casa C">
          </div>
        </div>
        <div class="calc-result" id="a3-result">
          <div class="calc-result-title">Resultado</div>
          <div id="a3-output"></div>
        </div>
      </div>
    </div>

    <!-- Scanner -->
    <div class="calc-card" style="margin-top:1.5rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;flex-wrap:wrap;gap:8px">
        <h3 style="margin-bottom:0">🔍 Scanner de Arbitragem — Dados Actuais</h3>
        <span id="arb-live-badge" style="
          display:inline-flex;align-items:center;gap:5px;
          font-size:11px;font-weight:600;
          background:var(--green-bg);color:var(--green);
          border:1px solid var(--green-dim);border-radius:20px;
          padding:3px 10px;
        ">
          <span style="
            display:inline-block;width:7px;height:7px;border-radius:50%;
            background:var(--green);animation:arbPulse 1.4s ease-in-out infinite;
          "></span>
          LIVE
        </span>
      </div>
      <p style="color:var(--muted);font-size:13px;margin-bottom:1rem">
        Detecta automaticamente surebets nos jogos carregados. Actualiza em tempo real com os dados do localStorage.
      </p>
      <div id="arb-scanner-output"></div>
    </div>
  `;

  // Injecta estilos uma única vez
  if (!document.getElementById("arb-style")) {
    const st = document.createElement("style");
    st.id = "arb-style";
    st.textContent = `
      @keyframes arbPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%      { opacity:.4; transform:scale(1.35); }
      }
      .arb-calc-box {
        background:var(--surface2);
        border:1px solid var(--blue);
        border-radius:var(--radius);
        padding:1rem 1.25rem;
        margin-top:.75rem;
        animation: arbFadeIn .2s ease;
      }
      @keyframes arbFadeIn {
        from { opacity:0; transform:translateY(-4px); }
        to   { opacity:1; transform:translateY(0); }
      }
      .arb-quick-btn {
        padding:3px 9px;font-size:11px;font-weight:600;
        border:1px solid var(--border);border-radius:5px;
        background:var(--surface);color:var(--muted);
        cursor:pointer;transition:all .15s;
      }
      .arb-quick-btn:hover { background:var(--blue-bg);color:var(--blue);border-color:var(--blue); }
      .arb-open-btn {
        padding:4px 12px;font-size:12px;font-weight:600;
        background:var(--blue-bg);color:var(--blue);
        border:1px solid #1a3a6b;border-radius:6px;cursor:pointer;
        transition:all .15s;margin-top:.6rem;display:inline-block;
      }
      .arb-open-btn:hover { background:#1a3a6b; }
      .arb-open-btn.active { background:var(--surface2);color:var(--muted);border-color:var(--border); }
      .arb-copy-btn {
        padding:4px 12px;font-size:12px;font-weight:600;
        background:var(--green-bg);color:var(--green);
        border:1px solid var(--green-dim);border-radius:6px;cursor:pointer;
        transition:all .15s;display:inline-block;margin-left:6px;
      }
      .arb-copy-btn:hover { background:var(--green-dim); }
      .arb-total-input {
        width:110px;padding:5px 9px;
        border:1.5px solid var(--blue);border-radius:6px;
        font-size:14px;font-weight:700;
        background:var(--surface);color:var(--text);
      }
      .arb-total-input:focus { outline:none;border-color:#7cb8ff; }
      .arb-opp-card {
        background:var(--green-bg);
        border:1px solid var(--green-dim);
        border-radius:var(--radius);
        padding:1rem 1.25rem;
        margin-bottom:.75rem;
      }
      .arb-opp-card:last-child { margin-bottom:0; }
    `;
    document.head.appendChild(st);
  }

  setupArbitrageEvents();
  calcArb2();
  calcArb3();
  refreshArbScanner();

  // ── Reage a mudanças no localStorage (mesmo separador via CustomEvent,
  //    outros separadores via storage event nativo) ─────────────────────────
  window.addEventListener("oddsdash:dataUpdated", refreshArbScanner);
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("oddsdash_")) refreshArbScanner();
  });
}

// ── Setup events dos inputs manuais ────────────────────────────────────────
function setupArbitrageEvents() {
  ["a2-total","a2-o1","a2-o2"].forEach(id =>
    document.getElementById(id).addEventListener("input", calcArb2));
  ["a3-total","a3-o1","a3-ox","a3-o2","a3-b1","a3-bx","a3-b2"].forEach(id =>
    document.getElementById(id).addEventListener("input", calcArb3));
}

// ── 2-way calc ─────────────────────────────────────────────────────────────
function calcArb2() {
  const total = parseFloat(document.getElementById("a2-total").value) || 0;
  const o1    = parseFloat(document.getElementById("a2-o1").value)    || 0;
  const o2    = parseFloat(document.getElementById("a2-o2").value)    || 0;
  const out   = document.getElementById("a2-output");
  if (!total || !o1 || !o2) {
    out.innerHTML = `<div style="color:var(--muted);font-size:12px">Preenche todos os campos.</div>`;
    return;
  }
  const margin = 1/o1 + 1/o2;
  const isArb  = margin < 1;
  const s1     = total / (o1 * margin);
  const s2     = total / (o2 * margin);
  const ret    = s1 * o1;
  const profit = ret - total;

  out.innerHTML = `
    <div class="calc-result-grid" style="margin-bottom:8px">
      <div class="calc-result-item"><div class="label">Aposta 1</div><div class="value value-blue">${curr(s1)}</div></div>
      <div class="calc-result-item"><div class="label">Aposta 2</div><div class="value value-blue">${curr(s2)}</div></div>
      <div class="calc-result-item"><div class="label">Retorno garantido</div><div class="value ${isArb?"value-green":"value-red"}">${curr(ret)}</div></div>
      <div class="calc-result-item"><div class="label">Lucro líquido</div><div class="value ${isArb?"value-green":"value-red"}">${isArb ? "+"+curr(profit) : "Margem "+((margin-1)*100).toFixed(2)+"%"}</div></div>
    </div>
    ${isArb
      ? `<div class="arb-opportunity"><div class="arb-text">✅ Surebet! Lucro de ${curr(profit)} (${((1/margin-1)*100).toFixed(2)}%) em ${curr(total)} investidos</div></div>`
      : `<div class="no-arb">Não há arbitragem. Margem combinada: ${(margin*100).toFixed(2)}% (&gt;100%).</div>`}`;
}

// ── 3-way calc ─────────────────────────────────────────────────────────────
function calcArb3() {
  const total = parseFloat(document.getElementById("a3-total").value) || 0;
  const o1    = parseFloat(document.getElementById("a3-o1").value)    || 0;
  const ox    = parseFloat(document.getElementById("a3-ox").value)    || 0;
  const o2    = parseFloat(document.getElementById("a3-o2").value)    || 0;
  const b1    = document.getElementById("a3-b1").value || "Casa A";
  const bx    = document.getElementById("a3-bx").value || "Casa B";
  const b2    = document.getElementById("a3-b2").value || "Casa C";
  const out   = document.getElementById("a3-output");

  if (!total || !o1 || !ox || !o2) {
    out.innerHTML = `<div style="color:var(--muted);font-size:12px">Preenche todos os campos.</div>`;
    return;
  }
  const margin = 1/o1 + 1/ox + 1/o2;
  const isArb  = margin < 1;
  const s1     = total / (o1 * margin);
  const sx     = total / (ox * margin);
  const s2     = total / (o2 * margin);
  const ret    = s1 * o1;
  const profit = ret - total;   // lucro líquido = retorno − investimento

  out.innerHTML = `
    <div class="calc-result-grid" style="margin-bottom:8px">
      <div class="calc-result-item"><div class="label">€ em 1 (${b1})</div><div class="value value-blue">${curr(s1)}</div></div>
      <div class="calc-result-item"><div class="label">€ em X (${bx})</div><div class="value">${curr(sx)}</div></div>
      <div class="calc-result-item"><div class="label">€ em 2 (${b2})</div><div class="value value-amber">${curr(s2)}</div></div>
      <div class="calc-result-item"><div class="label">Margem total</div><div class="value ${isArb?"value-green":"value-red"}">${(margin*100).toFixed(2)}%</div></div>
      <div class="calc-result-item"><div class="label">Retorno garantido</div><div class="value value-green">${isArb ? curr(ret) : "—"}</div></div>
      <div class="calc-result-item"><div class="label">Lucro líquido</div><div class="value ${isArb?"value-green":"value-red"}">${isArb ? "+"+curr(profit) : ((margin-1)*100).toFixed(2)+"%"}</div></div>
    </div>
    ${isArb
      ? `<div class="arb-opportunity">
           <div class="arb-text">✅ Surebet! Lucro de ${curr(profit)} (${((1/margin-1)*100).toFixed(2)}%) em ${curr(total)} investidos</div>
           <div style="font-size:12px;color:var(--green);margin-top:2px">Retorno garantido: ${curr(ret)} — qualquer resultado que ocorra</div>
         </div>`
      : `<div class="no-arb">Não há arbitragem. Margem combinada: ${(margin*100).toFixed(2)}%. Precisas de margem &lt; 100%.</div>`}`;
}

// ── Scanner principal ───────────────────────────────────────────────────────
function refreshArbScanner() {
  const el = document.getElementById("arb-scanner-output");
  if (!el) return;

  if (!AppState.games || !AppState.games.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:.5rem 0">A aguardar dados de odds…</div>`;
    return;
  }

  const surebets = detectSurebets();

  if (!surebets.length) {
    el.innerHTML = `
      <div class="no-arb" style="display:flex;gap:12px;align-items:flex-start">
        <span style="font-size:20px">📡</span>
        <div>
          <div style="font-weight:600;color:var(--text);margin-bottom:4px">Nenhuma surebet detectada agora</div>
          <div style="font-size:12px;color:var(--muted)">
            A maioria dos bookmakers europeus tem margens de 4–8%, tornando surebets raras.
            O scanner actualiza automaticamente sempre que chegam novos dados.
          </div>
          <div style="font-size:11px;color:var(--subtle);margin-top:4px">
            Dica: carrega mais ligas ou adiciona mais bookmakers para aumentar as hipóteses.
          </div>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = surebets.map((sb, idx) => renderSurebetCard(sb, idx)).join("");
}

// ── Detectar surebets nos dados actuais ────────────────────────────────────
function detectSurebets() {
  const found = [];
  AppState.games.forEach(g => {
    if (!g.bookmakers || g.bookmakers.length < 2) return;

    let bestH = { val: 0, name: "" };
    let bestD = { val: 0, name: "" };
    let bestA = { val: 0, name: "" };

    g.bookmakers.forEach(b => {
      if (b.home  > bestH.val) bestH = { val: b.home,  name: b.name };
      if (b.draw  > bestD.val) bestD = { val: b.draw,  name: b.name };
      if (b.away  > bestA.val) bestA = { val: b.away,  name: b.name };
    });

    if (bestH.val <= 0 || bestD.val <= 0 || bestA.val <= 0) return;

    const margin = 1/bestH.val + 1/bestD.val + 1/bestA.val;
    if (margin < 1) {
      found.push({
        game: g,
        margin,
        profitPct: (1/margin - 1) * 100,
        bestH, bestD, bestA,
      });
    }
  });

  return found.sort((a, b) => b.profitPct - a.profitPct);
}

// ── Render card de surebet ──────────────────────────────────────────────────
function renderSurebetCard(sb, idx) {
  const gameId = sb.game.id;
  const isOpen = ArbCalcState.activeId === gameId;
  const total  = ArbCalcState.totalInput || 1000;

  const s1     = total * (1/sb.bestH.val) / sb.margin;
  const sx     = total * (1/sb.bestD.val) / sb.margin;
  const s2     = total * (1/sb.bestA.val) / sb.margin;
  const ret    = s1 * sb.bestH.val;
  const profit = ret - total;
  const roi    = profit / total * 100;

  // Serializa sb de forma segura para atributos HTML
  const sbData = encodeURIComponent(JSON.stringify(sb));

  const calcHtml = isOpen ? `
    <div class="arb-calc-box">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:.9rem;flex-wrap:wrap">
        <span style="font-size:12px;font-weight:600;color:var(--muted)">💰 TOTAL A INVESTIR</span>
        <input
          class="arb-total-input"
          type="number" min="1" step="10"
          value="${total}"
          id="arb-input-${idx}"
          oninput="updateArbCalc(${idx}, this.value, '${sbData}')"
        >
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${[100,250,500,1000,2500,5000].map(v =>
            `<button class="arb-quick-btn" onclick="setArbTotal(${idx},${v},'${sbData}')">€${v.toLocaleString("pt")}</button>`
          ).join("")}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:.9rem">
        <div style="background:var(--blue-bg);border:1px solid #1a3a6b;border-radius:8px;padding:10px;text-align:center" id="s1-${idx}">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">1 Casa</div>
          <div style="font-size:22px;font-weight:800;color:var(--blue)">${curr(s1)}</div>
          <div style="font-size:11px;color:var(--blue);opacity:.8;margin-top:2px">@ ${sb.bestH.val.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sb.bestH.name}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center" id="sx-${idx}">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">X Empate</div>
          <div style="font-size:22px;font-weight:800;color:var(--muted)">${curr(sx)}</div>
          <div style="font-size:11px;color:var(--muted);opacity:.8;margin-top:2px">@ ${sb.bestD.val.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--subtle);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sb.bestD.name}</div>
        </div>
        <div style="background:var(--amber-bg);border:1px solid #6b4000;border-radius:8px;padding:10px;text-align:center" id="s2-${idx}">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">2 Fora</div>
          <div style="font-size:22px;font-weight:800;color:var(--amber)">${curr(s2)}</div>
          <div style="font-size:11px;color:var(--amber);opacity:.8;margin-top:2px">@ ${sb.bestA.val.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sb.bestA.name}</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding-top:.7rem;border-top:1px solid var(--border)">
        <div style="flex:1;min-width:180px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:2px">Retorno garantido (qualquer resultado)</div>
          <div style="font-size:20px;font-weight:800;color:var(--green)" id="ret-${idx}">${curr(ret)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--muted);margin-bottom:2px">Lucro líquido · ROI</div>
          <div style="font-size:20px;font-weight:800;color:var(--green)" id="prof-${idx}">
            +${curr(profit)} <span style="font-size:13px;opacity:.75">(${roi.toFixed(2)}%)</span>
          </div>
        </div>
      </div>

      <div style="margin-top:.75rem">
        <button class="arb-copy-btn" onclick="copyArbPlan(${idx},'${sb.game.home_team.replace(/'/g,"\\'")} vs ${sb.game.away_team.replace(/'/g,"\\'")}','${sbData}')">
          📋 Copiar plano
        </button>
      </div>
    </div>
  ` : "";

  return `
    <div class="arb-opp-card" id="card-${idx}">
      <div style="display:flex;align-items:flex-start;gap:10px;width:100%">
        <div style="flex:1">
          <div style="font-weight:700;color:var(--text);font-size:14px">${sb.game.home_team} vs ${sb.game.away_team}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${sb.game.league_name} · ${fmt(sb.game.commence_time)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:800;color:var(--green)">+${sb.profitPct.toFixed(2)}% lucro</div>
          <div style="font-size:11px;color:var(--muted)">Margem: ${(sb.margin*100).toFixed(2)}%</div>
        </div>
      </div>

      <div style="display:flex;gap:16px;margin-top:.7rem;flex-wrap:wrap;font-size:12px;align-items:center">
        <div>
          <span style="color:var(--muted)">1 Casa:</span>
          <strong style="color:var(--blue)">${sb.bestH.val.toFixed(2)}</strong>
          <span style="color:var(--subtle)">@ ${sb.bestH.name}</span>
        </div>
        <div>
          <span style="color:var(--muted)">X Empate:</span>
          <strong style="color:var(--text)">${sb.bestD.val.toFixed(2)}</strong>
          <span style="color:var(--subtle)">@ ${sb.bestD.name}</span>
        </div>
        <div>
          <span style="color:var(--muted)">2 Fora:</span>
          <strong style="color:var(--amber)">${sb.bestA.val.toFixed(2)}</strong>
          <span style="color:var(--subtle)">@ ${sb.bestA.name}</span>
        </div>
      </div>

      <div>
        <button
          class="arb-open-btn${isOpen ? " active" : ""}"
          onclick="toggleArbCalc('${gameId}', ${idx})"
        >${isOpen ? "▲ Fechar calculadora" : "🧮 Abrir calculadora"}</button>
      </div>

      ${calcHtml}
    </div>`;
}

// ── Toggle calculadora ──────────────────────────────────────────────────────
function toggleArbCalc(gameId, idx) {
  ArbCalcState.activeId = ArbCalcState.activeId === gameId ? null : gameId;
  refreshArbScanner();
  if (ArbCalcState.activeId === gameId) {
    setTimeout(() => {
      const el = document.getElementById(`arb-input-${idx}`);
      if (el) { el.focus(); el.select(); }
    }, 50);
  }
}

// ── Atualizar calculadora inline sem re-renderizar o card ──────────────────
function updateArbCalc(idx, val, sbEncoded) {
  const total = parseFloat(val) || 0;
  ArbCalcState.totalInput = total;
  if (total <= 0) return;

  const sb     = JSON.parse(decodeURIComponent(sbEncoded));
  const s1     = total * (1/sb.bestH.val) / sb.margin;
  const sx     = total * (1/sb.bestD.val) / sb.margin;
  const s2     = total * (1/sb.bestA.val) / sb.margin;
  const ret    = s1 * sb.bestH.val;
  const profit = ret - total;
  const roi    = profit / total * 100;

  const q = id => document.getElementById(id);
  const setVal = (id, text) => { const el = q(id); if (el) { const d = el.querySelector("div:nth-child(2)"); if (d) d.textContent = text; } };

  setVal(`s1-${idx}`, curr(s1));
  setVal(`sx-${idx}`, curr(sx));
  setVal(`s2-${idx}`, curr(s2));
  if (q(`ret-${idx}`))  q(`ret-${idx}`).textContent = curr(ret);
  if (q(`prof-${idx}`)) q(`prof-${idx}`).innerHTML =
    `+${curr(profit)} <span style="font-size:13px;opacity:.75">(${roi.toFixed(2)}%)</span>`;
}

function setArbTotal(idx, val, sbEncoded) {
  ArbCalcState.totalInput = val;
  const inp = document.getElementById(`arb-input-${idx}`);
  if (inp) inp.value = val;
  updateArbCalc(idx, val, sbEncoded);
}

// ── Copiar plano para clipboard ────────────────────────────────────────────
function copyArbPlan(idx, gameName, sbEncoded) {
  const sb     = JSON.parse(decodeURIComponent(sbEncoded));
  const total  = ArbCalcState.totalInput || 1000;
  const s1     = total * (1/sb.bestH.val) / sb.margin;
  const sx     = total * (1/sb.bestD.val) / sb.margin;
  const s2     = total * (1/sb.bestA.val) / sb.margin;
  const ret    = s1 * sb.bestH.val;
  const profit = ret - total;

  const txt = [
    `⚖️ PLANO DE ARBITRAGEM`,
    `Jogo: ${gameName}`,
    ``,
    `📌 Apostas:`,
    `  1 Casa   → ${curr(s1)} @ ${sb.bestH.val.toFixed(2)} em ${sb.bestH.name}`,
    `  X Empate → ${curr(sx)} @ ${sb.bestD.val.toFixed(2)} em ${sb.bestD.name}`,
    `  2 Fora   → ${curr(s2)} @ ${sb.bestA.val.toFixed(2)} em ${sb.bestA.name}`,
    ``,
    `💰 Total investido:   ${curr(total)}`,
    `📈 Retorno garantido: ${curr(ret)}`,
    `✅ Lucro líquido:     +${curr(profit)} (+${(profit/total*100).toFixed(2)}%)`,
    ``,
    `Margem: ${(sb.margin*100).toFixed(2)}% · Gerado por OddsDash`,
  ].join("\n");

  navigator.clipboard.writeText(txt).catch(() => {});

  const btns = document.querySelectorAll(".arb-copy-btn");
  const btn  = btns[idx];
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "✅ Copiado!";
    setTimeout(() => btn.textContent = orig, 2000);
  }
}