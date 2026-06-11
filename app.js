/* CriptoEconomía — monitor estadístico. Datos: CoinGecko y alternative.me */

const COINS = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    color: "#b45309",
    note:
      "Oferta rígida con tope de 21 M de unidades y emisión decreciente (halving cada ~4 años). " +
      "Se analiza como reserva de valor y actúa como factor sistemático del mercado cripto.",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    color: "#3b5bdb",
    note:
      "Infraestructura de contratos inteligentes (DeFi, stablecoins, tokenización). EIP-1559 quema " +
      "parte de las comisiones (presión deflacionaria endógena); el staking rinde ~3-4% anual y opera " +
      "como tasa de referencia interna.",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    color: "#92750c",
    note:
      "Token del ecosistema Binance. Quemas trimestrales con cargo a beneficios — mecanismo análogo " +
      "a la recompra de acciones — con objetivo final de 100 M de unidades en circulación.",
  },
];

const WINDOW_DAYS = 90;   // ventana estadística (volatilidad, beta, correlaciones)
const FETCH_DAYS = 365;   // serie descargada: 1 año (los 90 días se recortan de ella)

/* Referencias tradicionales para la matriz de correlaciones, vía proxies
   tokenizados disponibles en la misma API (sin fuentes ni claves adicionales). */
const CORR_EXTRAS = [
  { id: "pax-gold", symbol: "ORO", name: "Oro (PAXG)" },
  { id: "ishares-core-s-p-500-etf-ondo-tokenized-etf", symbol: "SP500", name: "S&P 500 (ETF tokenizado)" },
];

/* ---------- Formato ---------- */
const fmtUSD = (n, opts = {}) =>
  n == null
    ? "–"
    : new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: n < 10 ? 4 : 2,
        ...opts,
      }).format(n);

const fmtCompact = (n) =>
  n == null
    ? "–"
    : new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 2 }).format(n);

const fmtPct = (n, digits = 2) =>
  n == null || Number.isNaN(n) ? "–" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

const fmtNum = (n, digits = 0) =>
  n == null ? "–" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits }).format(n);

const pctClass = (n) => (n == null ? "" : n >= 0 ? "up" : "down");

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

/* Cache en localStorage con TTL: amortigua el rate limit de la API gratuita
   (las series de 90 días apenas cambian entre recargas). */
async function fetchJSONCached(url, ttlMs) {
  const key = `ce-cache:${url}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key));
    if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  } catch (_) { /* cache corrupta: se ignora */ }
  try {
    const v = await fetchJSON(url);
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch (_) {}
    return v;
  } catch (e) {
    // Si la red falla, servir cache vencida antes que nada
    try {
      const stale = JSON.parse(localStorage.getItem(key));
      if (stale) return stale.v;
    } catch (_) {}
    throw e;
  }
}

/* ---------- Estadística ---------- */
function logReturns(prices) {
  const r = [];
  for (let i = 1; i < prices.length; i++) r.push(Math.log(prices[i] / prices[i - 1]));
  return r;
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function variance(xs) {
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

function covariance(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (xs.length - 1);
}

const annualizedVol = (returns) => Math.sqrt(variance(returns)) * Math.sqrt(365) * 100;

const correlation = (xs, ys) =>
  covariance(xs, ys) / Math.sqrt(variance(xs) * variance(ys));

const beta = (asset, market) => covariance(asset, market) / variance(market);

function maxDrawdown(prices) {
  let peak = prices[0];
  let mdd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (p - peak) / peak;
    if (dd < mdd) mdd = dd;
  }
  return mdd * 100;
}

/* ---------- Cinta de cotizaciones ---------- */
function renderTape(markets) {
  document.getElementById("tape").innerHTML = COINS.map((coin) => {
    const m = markets.find((x) => x.id === coin.id);
    return `<span class="tape-item">
        <img class="coin-ico" src="${m.image}" alt="${coin.name}" />
        <strong>${coin.symbol}</strong> ${fmtUSD(m.current_price)}
        <span class="${pctClass(m.price_change_percentage_24h)}">${fmtPct(m.price_change_percentage_24h)}</span>
      </span>`;
  }).join('<span class="tape-sep">·</span>');
}

/* ---------- Agregados de mercado ---------- */
function renderGlobalStats(global) {
  const d = global.data;
  const totalMcap = d.total_market_cap.usd;
  const totalVol = d.total_volume.usd;
  const stats = [
    {
      label: "Capitalización total",
      value: `$${fmtCompact(totalMcap)}`,
      sub: `${fmtPct(d.market_cap_change_percentage_24h_usd)} en 24 h`,
      cls: pctClass(d.market_cap_change_percentage_24h_usd),
    },
    {
      label: "Volumen 24 h",
      value: `$${fmtCompact(totalVol)}`,
      sub: "Negociación agregada",
    },
    {
      label: "Dominancia BTC / ETH",
      value: `${d.market_cap_percentage.btc.toFixed(1)}% / ${d.market_cap_percentage.eth.toFixed(1)}%`,
      sub: `BNB: ${(d.market_cap_percentage.bnb || 0).toFixed(1)}%`,
    },
    {
      label: "Activos listados",
      value: fmtNum(d.active_cryptocurrencies),
      sub: `${fmtNum(d.markets)} mercados activos`,
    },
  ];

  document.getElementById("globalStats").innerHTML = stats
    .map(
      (s) => `
      <div class="stat-card">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub ${s.cls || ""}">${s.sub}</div>
      </div>`
    )
    .join("");

  const ratio = (totalVol / totalMcap) * 100;
  document.getElementById("volMcapRatio").textContent = `${ratio.toFixed(2)}%`;
  document.getElementById("btcDominance").textContent = `${d.market_cap_percentage.btc.toFixed(1)}%`;
}

/* ---------- Matriz de retornos y riesgo ---------- */
function renderRiskTable(markets, series) {
  const btcReturns = logReturns(series.bitcoin);
  const rows = COINS.map((coin) => {
    const m = markets.find((x) => x.id === coin.id);
    const prices = series[coin.id];
    const rets = logReturns(prices);
    const vol = annualizedVol(rets);
    const mdd = maxDrawdown(prices);
    const b = coin.id === "bitcoin" ? 1 : beta(rets, btcReturns);
    return `
      <tr>
        <td><img class="coin-ico" src="${m.image}" alt="" /> <strong>${coin.symbol}</strong> <span class="muted-inline">${coin.name}</span></td>
        <td class="num">${fmtUSD(m.current_price)}</td>
        <td class="num ${pctClass(m.price_change_percentage_24h)}">${fmtPct(m.price_change_percentage_24h)}</td>
        <td class="num ${pctClass(m.price_change_percentage_7d_in_currency)}">${fmtPct(m.price_change_percentage_7d_in_currency)}</td>
        <td class="num ${pctClass(m.price_change_percentage_30d_in_currency)}">${fmtPct(m.price_change_percentage_30d_in_currency)}</td>
        <td class="num ${pctClass(m.price_change_percentage_1y_in_currency)}">${fmtPct(m.price_change_percentage_1y_in_currency, 1)}</td>
        <td class="num">${vol.toFixed(1)}%</td>
        <td class="num down">${mdd.toFixed(1)}%</td>
        <td class="num">${b.toFixed(2)}</td>
      </tr>`;
  });
  document.querySelector("#riskTable tbody").innerHTML = rows.join("");
}

/* ---------- Matriz de correlaciones ---------- */
const fmtCorr = (n) => n.toFixed(2).replace(".", ",");

function renderCorrTable(assets) {
  const rets = {};
  for (const a of assets) rets[a.symbol] = logReturns(a.prices);
  const syms = assets.map((a) => a.symbol);
  const cryptoSyms = COINS.map((c) => c.symbol);

  document.querySelector("#corrTable thead tr").innerHTML =
    `<th></th>` + syms.map((s) => `<th class="num">${s}</th>`).join("");

  const rows = syms.map((rowSym) => {
    const cells = syms.map((colSym) => {
      if (rowSym === colSym) return `<td class="num corr-diag">1,00</td>`;
      const c = correlation(rets[rowSym], rets[colSym]);
      return `<td class="num">${fmtCorr(c)}</td>`;
    });
    return `<tr><td><strong>${rowSym}</strong></td>${cells.join("")}</tr>`;
  });
  document.querySelector("#corrTable tbody").innerHTML = rows.join("");

  // Lectura analítica: pares extremos y medias intra-cripto / cruzadas
  const pairs = [];
  for (let i = 0; i < syms.length; i++)
    for (let j = i + 1; j < syms.length; j++)
      pairs.push({
        a: syms[i],
        b: syms[j],
        pair: `${syms[i]}–${syms[j]}`,
        c: correlation(rets[syms[i]], rets[syms[j]]),
      });
  const maxP = pairs.reduce((a, b) => (b.c > a.c ? b : a));
  const minP = pairs.reduce((a, b) => (b.c < a.c ? b : a));

  const isCrypto = (s) => cryptoSyms.includes(s);
  const intraPairs = pairs.filter((p) => isCrypto(p.a) && isCrypto(p.b));
  const crossPairs = pairs.filter((p) => isCrypto(p.a) !== isCrypto(p.b));
  const intraAvg = mean(intraPairs.map((p) => p.c));
  const crossAvg = crossPairs.length ? mean(crossPairs.map((p) => p.c)) : null;

  const crossItem =
    crossAvg == null
      ? ""
      : `<li><span>Media cripto–tradicionales</span><strong>${fmtCorr(crossAvg)}</strong></li>`;

  const reading =
    crossAvg == null
      ? intraAvg >= 0.7
        ? "Con correlaciones medias por encima de 0,70, la diversificación intra-cripto aporta poca reducción de riesgo: la cobertura efectiva exige activos externos al ecosistema."
        : "Correlaciones moderadas dentro del ecosistema, aunque tienden a converger a 1 en episodios de estrés."
      : crossAvg < 0.4 && intraAvg >= 0.6
      ? "Los criptoactivos se mueven en bloque entre sí, pero su correlación con oro y S&P 500 es baja: la diversificación efectiva de una cartera cripto proviene de los activos tradicionales, no de combinar criptoactivos."
      : crossAvg < 0.6
      ? "La correlación de los criptoactivos con las referencias tradicionales es intermedia: aportan diversificación parcial, menor en episodios de estrés global."
      : "En la ventana actual los criptoactivos exhiben correlación alta incluso con las referencias tradicionales: el beneficio de diversificación es limitado en todo el espectro.";

  document.getElementById("corrInsights").innerHTML = `
    <h3>Lectura de la ventana</h3>
    <ul>
      <li><span>Par más correlacionado</span><strong>${maxP.pair} (${fmtCorr(maxP.c)})</strong></li>
      <li><span>Par menos correlacionado</span><strong>${minP.pair} (${fmtCorr(minP.c)})</strong></li>
      <li><span>Media intra-cripto</span><strong>${fmtCorr(intraAvg)}</strong></li>
      ${crossItem}
    </ul>
    <p>${reading}</p>`;
}

/* ---------- Series de precios ---------- */
function drawPriceChart(canvasId, points, color, maxTicks, labelOpts) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = points.map(([ts]) =>
    new Date(ts).toLocaleDateString("es-ES", labelOpts || { day: "numeric", month: "short" })
  );
  const values = points.map(([, p]) => p);

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data: values,
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => fmtUSD(c.parsed.y) } },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#6b7280", maxTicksLimit: maxTicks, font: { size: 11 } },
        },
        y: {
          grid: { color: "rgba(107,114,128,0.15)" },
          ticks: {
            color: "#6b7280",
            font: { size: 11 },
            callback: (v) => `$${fmtCompact(v)}`,
          },
        },
      },
    },
  });
}

function renderChartBlocks(seriesRaw) {
  const container = document.getElementById("chartBlocks");
  container.innerHTML = COINS.map(
    (coin) => `
    <div class="chart-pair">
      <figure class="chart-block">
        <figcaption>${coin.icon ? `<img class="coin-ico" src="${coin.icon}" alt="" /> ` : ""}<strong>${coin.symbol}</strong> — ${coin.name}, cierre diario USD (${WINDOW_DAYS} d)</figcaption>
        <div class="chart-canvas"><canvas id="chart-${coin.id}-90"></canvas></div>
      </figure>
      <figure class="chart-block">
        <figcaption>${coin.icon ? `<img class="coin-ico" src="${coin.icon}" alt="" /> ` : ""}<strong>${coin.symbol}</strong> — ${coin.name}, cierre diario USD (1 año)</figcaption>
        <div class="chart-canvas"><canvas id="chart-${coin.id}-1y"></canvas></div>
      </figure>
    </div>`
  ).join("");

  for (const coin of COINS) {
    const points = seriesRaw[coin.id];
    drawPriceChart(`chart-${coin.id}-90`, points.slice(-(WINDOW_DAYS + 1)), coin.color, 9);
    drawPriceChart(`chart-${coin.id}-1y`, points, coin.color, 12, { month: "short", year: "2-digit" });
  }
}

/* ---------- Fundamentos ---------- */
function renderCompareTable(markets) {
  const get = (id) => markets.find((m) => m.id === id);
  const ms = [get("bitcoin"), get("ethereum"), get("binancecoin")];

  document.querySelector("#compareTable thead tr").innerHTML =
    `<th>Métrica</th>` +
    ms
      .map(
        (m) =>
          `<th class="num"><img class="coin-ico" src="${m.image}" alt="" /> ${m.name} (${m.symbol.toUpperCase()})</th>`
      )
      .join("");

  const rows = [
    ["Capitalización", ...ms.map((m) => `$${fmtCompact(m.market_cap)}`)],
    ["Ranking por capitalización", ...ms.map((m) => `#${m.market_cap_rank}`)],
    ["Volumen 24 h", ...ms.map((m) => `$${fmtCompact(m.total_volume)}`)],
    ["Vol. 24 h / Capitalización", ...ms.map((m) => `${((m.total_volume / m.market_cap) * 100).toFixed(2)}%`)],
    ["Oferta circulante", ...ms.map((m) => fmtCompact(m.circulating_supply))],
    ["Oferta máxima", ...ms.map((m) => (m.max_supply ? fmtCompact(m.max_supply) : "Sin tope"))],
    ["% emitido del máximo", ...ms.map((m) => (m.max_supply ? `${((m.circulating_supply / m.max_supply) * 100).toFixed(1)}%` : "—"))],
    ["Máximo histórico (ATH)", ...ms.map((m) => fmtUSD(m.ath))],
    ["Distancia al ATH", ...ms.map((m) => fmtPct(m.ath_change_percentage, 1))],
    ["Fecha del ATH", ...ms.map((m) => new Date(m.ath_date).toLocaleDateString("es-ES", { month: "short", year: "numeric" }))],
  ];

  document.querySelector("#compareTable tbody").innerHTML = rows
    .map(
      ([label, ...vals]) =>
        `<tr><td>${label}</td>${vals
          .map((v) => `<td class="num ${String(v).startsWith("+") ? "up" : String(v).startsWith("-") ? "down" : ""}">${v}</td>`)
          .join("")}</tr>`
    )
    .join("");

  document.getElementById("fundNotes").innerHTML = COINS.map(
    (coin) => `<p><strong>${coin.symbol}.</strong> ${coin.note}</p>`
  ).join("");
}

/* ---------- Fear & Greed ---------- */
async function renderFearGreed() {
  try {
    const data = await fetchJSON("https://api.alternative.me/fng/?limit=1");
    const item = data.data[0];
    const labels = {
      "Extreme Fear": "Miedo extremo",
      Fear: "Miedo",
      Neutral: "Neutral",
      Greed: "Codicia",
      "Extreme Greed": "Codicia extrema",
    };
    document.getElementById("fngValue").textContent = `${item.value}/100`;
    document.getElementById("fngLabel").textContent =
      labels[item.value_classification] || item.value_classification;
  } catch (e) {
    console.warn("No se pudo cargar el índice Fear & Greed:", e);
    document.getElementById("fngLabel").textContent = "No disponible";
  }
}

/* ---------- Init ---------- */
const TTL_MARKETS = 2 * 60 * 1000;   // precios/agregados: 2 min
const TTL_SERIES = 30 * 60 * 1000;   // series de 90 días: 30 min

async function init() {
  const badge = document.getElementById("liveBadge");

  const chartURL = (id) =>
    `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${FETCH_DAYS}&interval=daily`;

  const [marketsR, globalR, ...seriesR] = await Promise.allSettled([
    fetchJSONCached(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin&order=market_cap_desc&price_change_percentage=24h,7d,30d,1y",
      TTL_MARKETS
    ),
    fetchJSONCached("https://api.coingecko.com/api/v3/global", TTL_MARKETS),
    ...COINS.map((c) => fetchJSONCached(chartURL(c.id), TTL_SERIES)),
    ...CORR_EXTRAS.map((x) => fetchJSONCached(chartURL(x.id), TTL_SERIES)),
  ]);
  const chartsR = seriesR.slice(0, COINS.length);
  const extrasR = seriesR.slice(COINS.length);

  const markets = marketsR.status === "fulfilled" ? marketsR.value : null;
  const global = globalR.status === "fulfilled" ? globalR.value : null;
  const chartsOk = chartsR.every((r) => r.status === "fulfilled");

  let seriesRaw = null, series = null;
  if (chartsOk) {
    seriesRaw = {}; series = {};
    COINS.forEach((c, i) => {
      seriesRaw[c.id] = chartsR[i].value.prices; // serie anual completa (gráficos)
      series[c.id] = chartsR[i].value.prices
        .slice(-(WINDOW_DAYS + 1))
        .map(([, p]) => p); // ventana de 90 días (estadísticas)
    });
  }

  // Render parcial: cada bloque se pinta con los datos que estén disponibles
  if (markets) {
    COINS.forEach((c) => {
      const m = markets.find((x) => x.id === c.id);
      if (m) c.icon = m.image;
    });
    renderTape(markets);
    renderCompareTable(markets);
  }
  if (global) renderGlobalStats(global);
  if (markets && series) renderRiskTable(markets, series);
  if (series) {
    const corrAssets = COINS.map((c) => ({
      symbol: c.symbol,
      prices: series[c.id],
    }));
    CORR_EXTRAS.forEach((x, i) => {
      if (extrasR[i].status === "fulfilled") {
        corrAssets.push({
          symbol: x.symbol,
          prices: extrasR[i].value.prices.slice(-(WINDOW_DAYS + 1)).map(([, p]) => p),
        });
      }
    });
    renderCorrTable(corrAssets);
    renderChartBlocks(seriesRaw);
  }

  const allOk = markets && global && chartsOk;
  if (allOk) {
    badge.classList.remove("error");
    badge.textContent = "DATOS EN VIVO";
    document.getElementById("lastUpdate").textContent =
      `Última actualización: ${new Date().toLocaleString("es-ES")} · Fuentes: CoinGecko, alternative.me · Ventana estadística: ${WINDOW_DAYS} días`;
  } else if (markets || global || series) {
    badge.classList.add("error");
    badge.textContent = "DATOS PARCIALES";
    document.getElementById("lastUpdate").textContent =
      "Carga parcial: la API pública de CoinGecko limitó algunas consultas. Los bloques faltantes se completarán en el próximo refresco automático.";
  } else {
    badge.classList.add("error");
    badge.textContent = "ERROR DE CONEXIÓN";
    document.getElementById("lastUpdate").textContent =
      "No se pudieron cargar los datos. Verificá la conexión o reintentá en unos minutos (límite de la API pública de CoinGecko).";
  }

  renderFearGreed();
  return allOk;
}

async function start() {
  const ok = await init();
  // Si la primera carga quedó incompleta por rate limit, reintentar antes
  if (!ok) setTimeout(init, 45000);
  // Refresco automático cada 3 minutos (respeta el rate limit de la API gratuita)
  setInterval(init, 180000);
}

start();
