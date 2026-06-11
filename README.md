# CriptoEconomía

Sitio web informativo sobre criptomonedas (Bitcoin, Ethereum y BNB) orientado a profesionales de la economía, con datos e índices de mercado en tiempo real.

## Contenido

- **Indicadores macro**: capitalización total, volumen 24 h, dominancia de BTC y cantidad de activos listados.
- **Análisis por activo**: perfil económico, política monetaria del protocolo, métricas clave y gráfico de precio de 30 días para BTC, ETH y BNB.
- **Tabla comparativa** de métricas lado a lado.
- **Índices económicos**: Índice de Miedo y Codicia, dominancia de Bitcoin y ratio volumen/capitalización.
- **Glosario** con equivalencias entre conceptos cripto y económicos tradicionales.

## Fuentes de datos

- [CoinGecko API](https://www.coingecko.com/es/api) (precios, capitalización, volumen, históricos) — plan gratuito, ~30 solicitudes/min.
- [alternative.me](https://alternative.me/crypto/fear-and-greed-index/) (Índice de Miedo y Codicia).

Los datos se refrescan automáticamente cada 2 minutos.

## Cómo ejecutarlo

Es un sitio estático sin dependencias de build. Basta con servir la carpeta:

```powershell
# Con Python instalado
python -m http.server 8000

# O abrir index.html directamente en el navegador
```

Luego visitar `http://localhost:8000`.

## Estructura

```
cripto-economia/
├── index.html   # Estructura y contenido
├── styles.css   # Estilos (tema oscuro profesional)
├── app.js       # Lógica de datos en vivo y gráficos (Chart.js vía CDN)
└── README.md
```

## Aviso

Este sitio tiene fines exclusivamente informativos y educativos. No constituye asesoramiento financiero.
