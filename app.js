/* CriptoEconomía — datos en vivo desde CoinGecko y alternative.me */

const COINS = [
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    color: "#f7931a",
    desc:
      "Primer criptoactivo y referencia del mercado. Su política monetaria es completamente " +
      "rígida: emisión decreciente programada (halving cada ~4 años) con tope absoluto de " +
      "21 millones de unidades. Suele analizarse como reserva de valor digital y se lo compara " +
      "con el oro por su escasez verificable. Su precio actúa como factor sistemático del resto " +
      "del mercado cripto.",
  },
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    color: "#627eea",
    desc:
      "Plataforma de contratos inteligentes que sostiene la mayor parte de la economía " +
      "descentralizada (DeFi, stablecoins, tokenización). Desde EIP-1559 parte de las comisiones " +
      "se quema, generando presión deflacionaria variable según la actividad de la red. El staking " +
      "ofrece un rendimiento endógeno (~3-4% anual) que funciona como tasa de referencia interna " +
      "del ecosistema.",
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    color: "#f0b90b",
    desc:
      "Token nativo del ecosistema Binance (exchange y BNB Chain). Su valor está vinculado a la " +
      "actividad comercial de la plataforma: descuentos en comisiones, uso como gas en la cadena " +
      "y quemas trimestrales con cargo a beneficios, un mecanismo análogo a la recompra de " +
      "acciones que reduce la oferta de forma sostenida (objetivo final: 100 M de unidades).",
  },
];

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
  n == null ? "–" : `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

const fmtNum = (n) =>
  n == null ? "–" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n);

const pctClass = (n) => (n >= 0 ? "up" : "down");

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.json();
}

/* ---------- Tickers del hero ---------- */
function renderTickers(markets) {
  const el = document.getElementById("heroTickers");
  el.innerHTML = markets
    .map(
      (c) => `
      <div class="ticker">
        <img src="${c.image}" alt="${c.name}" />
        <div class="ticker-info">
          <div class="ticker-name">${c.name}</div>
          <div class="ticker-symbol">${c.symbol}</div>
        </div>
        <div>
          <div class="ticker-price">${fmtUSD(c.current_price)}</div>
          <div class="ticker-change ${pctClass(c.price_change_percentage_24h)}">
            ${fmtPct(c.price_change_percentage_24h)} · 24h
          </div>
        </div>
      </div>`
    )
    .join("");
}

/* ---------- Indicadores globales ---------- */
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
      sub: "Negociación agregada del mercado",
    },
    {
      label: "Dominancia BTC",
      value: `${d.market_cap_percentage.btc.toFixed(1)}%`,
      sub: `ETH: ${d.market_cap_percentage.eth.toFixed(1)}% · BNB: ${(d.market_cap_percentage.bnb || 0).toFixed(1)}%`,
    },
    {
      label: "Criptoactivos listados",
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

  // Índice volumen / capitalización
  const ratio = (totalVol / totalMcap) * 100;
  document.getElementById("volMcapRatio").textContent = `${ratio.toFixed(2)}%`;
  document.getElementById("btcDominance").textContent = `${d.market_cap_percentage.btc.toFixed(1)}%`;
}

/* ---------- Secciones por moneda ---------- */
function renderCoinSections(markets) {
  const container = document.getElementById("coinSections");
  container.innerHTML = COINS.map((coin) => {
    const m = markets.find((x) => x.id === coin.id);
    const supplyPct =
      m.max_supply != null ? `${((m.circulating_supply / m.max_supply) * 100).toFixed(1)}% del máximo` : "Sin tope de emisión";
    return `
      <article class="coin-block" id="coin-${coin.id}">
        <div class="coin-info">
          <div class="coin-head">
            <img src="${m.image}" alt="${coin.name}" />
            <h3>${coin.name}</h3>
            <span class="sym">${coin.symbol}</span>
          </div>
          <p class="coin-desc">${coin.desc}</p>
          <div class="coin-metrics">
            <div class="metric"><div class="m-label">Precio</div><div class="m-value">${fmtUSD(m.current_price)}</div></div>
            <div class="metric"><div class="m-label">Variación 24 h</div><div class="m-value ${pctClass(m.price_change_percentage_24h)}">${fmtPct(m.price_change_percentage_24h)}</div></div>
            <div class="metric"><div class="m-label">Capitalización</div><div class="m-value">$${fmtCompact(m.market_cap)}</div></div>
            <div class="metric"><div class="m-label">Volumen 24 h</div><div class="m-value">$${fmtCompact(m.total_volume)}</div></div>
            <div class="metric"><div class="m-label">Oferta circulante</div><div class="m-value">${fmtCompact(m.circulating_supply)} ${coin.symbol}</div></div>
            <div class="metric"><div class="m-label">Emisión</div><div class="m-value">${supplyPct}</div></div>
            <div class="metric"><div class="m-label">Máximo histórico</div><div class="m-value">${fmtUSD(m.ath)}</div></div>
            <div class="metric"><div class="m-label">Desde el máximo</div><div class="m-value ${pctClass(m.ath_change_percentage)}">${fmtPct(m.ath_change_percentage, 1)}</div></div>
          </div>
        </div>
        <div class="coin-chart">
          <canvas id="chart-${coin.id}"></canvas>
          <div class="chart-caption">Precio de cierre diario — últimos 30 días (USD)</div>
        </div>
      </article>`;
  }).join("");
}

async function renderCharts() {
  for (const coin of COINS) {
    try {
      const data = await fetchJSON(
        `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=30&interval=daily`
      );
      const points = data.prices;
      const labels = points.map(([ts]) =>
        new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      );
      const values = points.map(([, p]) => p);

      const ctx = document.getElementById(`chart-${coin.id}`);
      if (!ctx) continue;

      new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              data: values,
              borderColor: coin.color,
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: true,
              backgroundColor: (c) => {
                const g = c.chart.ctx.createLinearGradient(0, 0, 0, c.chart.height);
                g.addColorStop(0, coin.color + "33");
                g.addColorStop(1, coin.color + "00");
                return g;
              },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: { label: (c) => fmtUSD(c.parsed.y) },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#93a0b8", maxTicksLimit: 7, font: { size: 11 } },
            },
            y: {
              grid: { color: "rgba(147,160,184,0.1)" },
              ticks: {
                color: "#93a0b8",
                font: { size: 11 },
                callback: (v) => `$${fmtCompact(v)}`,
              },
            },
          },
        },
      });
    } catch (e) {
      console.warn(`No se pudo cargar el gráfico de ${coin.name}:`, e);
    }
  }
}

/* ---------- Tabla comparativa ---------- */
function renderCompareTable(markets) {
  const get = (id) => markets.find((m) => m.id === id);
  const [btc, eth, bnb] = [get("bitcoin"), get("ethereum"), get("binancecoin")];

  const rows = [
    ["Precio (USD)", ...[btc, eth, bnb].map((m) => fmtUSD(m.current_price))],
    ["Capitalización", ...[btc, eth, bnb].map((m) => `$${fmtCompact(m.market_cap)}`)],
    ["Volumen 24 h", ...[btc, eth, bnb].map((m) => `$${fmtCompact(m.total_volume)}`)],
    ["Variación 24 h", ...[btc, eth, bnb].map((m) => fmtPct(m.price_change_percentage_24h))],
    ["Oferta circulante", ...[btc, eth, bnb].map((m) => fmtCompact(m.circulating_supply))],
    ["Oferta máxima", ...[btc, eth, bnb].map((m) => (m.max_supply ? fmtCompact(m.max_supply) : "Sin tope"))],
    ["Máximo histórico", ...[btc, eth, bnb].map((m) => fmtUSD(m.ath))],
    ["Distancia al ATH", ...[btc, eth, bnb].map((m) => fmtPct(m.ath_change_percentage, 1))],
    ["Ranking por cap.", ...[btc, eth, bnb].map((m) => `#${m.market_cap_rank}`)],
  ];

  document.querySelector("#compareTable tbody").innerHTML = rows
    .map(
      ([label, ...vals]) =>
        `<tr><td>${label}</td>${vals
          .map((v) => `<td class="${String(v).startsWith("+") ? "up" : String(v).startsWith("-") ? "down" : ""}">${v}</td>`)
          .join("")}</tr>`
    )
    .join("");
}

/* ---------- Fear & Greed ---------- */
async function renderFearGreed() {
  try {
    const data = await fetchJSON("https://api.alternative.me/fng/?limit=1");
    const item = data.data[0];
    const value = Number(item.value);
    const labels = {
      "Extreme Fear": "Miedo extremo",
      Fear: "Miedo",
      Neutral: "Neutral",
      Greed: "Codicia",
      "Extreme Greed": "Codicia extrema",
    };
    const color = value <= 25 ? "#e74c3c" : value <= 45 ? "#e67e22" : value <= 55 ? "#f1c40f" : value <= 75 ? "#2ecc71" : "#27ae60";

    document.getElementById("fngValue").textContent = value;
    document.getElementById("fngLabel").textContent = labels[item.value_classification] || item.value_classification;
    document.getElementById("fngGauge").style.background =
      `conic-gradient(${color} ${value * 3.6}deg, var(--surface-2) ${value * 3.6}deg)`;
  } catch (e) {
    console.warn("No se pudo cargar el índice Fear & Greed:", e);
    document.getElementById("fngLabel").textContent = "No disponible";
  }
}

/* ---------- Init ---------- */
async function init() {
  const badge = document.getElementById("liveBadge");
  try {
    const [markets, global] = await Promise.all([
      fetchJSON(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin&order=market_cap_desc"
      ),
      fetchJSON("https://api.coingecko.com/api/v3/global"),
    ]);

    renderTickers(markets);
    renderGlobalStats(global);
    renderCoinSections(markets);
    renderCompareTable(markets);
    renderCharts();

    document.getElementById("lastUpdate").textContent =
      `Última actualización: ${new Date().toLocaleString("es-ES")} · Fuente: CoinGecko`;
  } catch (e) {
    console.error("Error cargando datos de mercado:", e);
    badge.classList.add("error");
    badge.innerHTML = '<span class="dot"></span> Error de conexión';
    document.getElementById("lastUpdate").textContent =
      "No se pudieron cargar los datos. Verificá tu conexión o el límite de la API (CoinGecko gratuita: ~30 req/min).";
  }

  renderFearGreed();
}

init();
// Refresco automático cada 2 minutos (respeta el rate limit de la API gratuita)
setInterval(init, 120000);
