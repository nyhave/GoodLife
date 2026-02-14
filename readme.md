# ORB Trading System

An Opening Range Breakout (ORB) day trading application with backtesting, sentiment analysis, and a real-time simulation dashboard. Built with React (CDN) and requires no build step.

## Features

- **ORB Strategy Engine** - Configurable Opening Range Breakout strategy with partial profits, trailing stops, and volume confirmation
- **Backtesting** - Test the strategy across 60+ days of generated historical data with full metrics (Sharpe, Sortino, profit factor, Monte Carlo simulation)
- **Pre-Market Sentiment Analysis** - News, social media, options flow, gap analysis, and analyst ratings aggregated into a composite score
- **Live Simulation Dashboard** - Watch the trading day unfold minute-by-minute with candlestick charts, opening range overlay, trade signals, and risk monitoring
- **10 Tickers** - SPY, QQQ, AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META, JPM

## Usage

Open `index.html` in your browser. No server or build step required.

## Tabs

- **Overview** - Market overview showing all 10 tracked stocks at a glance with price action, strategy P&L, and sentiment
- **Simulation** - Watch the ORB strategy run minute-by-minute on a single ticker with full control over simulation speed and stock selection
- **Sentiment** - Pre-market sentiment rankings and detailed analysis per ticker
- **Backtest** - Configure and run historical backtests with equity curves and performance metrics
- **Strategy** - View and modify ORB strategy parameters and rules
- **Learn** - Educational background on the ORB strategy: what it is, why it works, history, and best practices
- **Admin** - System administration and cache management


## Real broker data (optional)

By default, this project uses simulated market data in-browser.
If you want real broker market data, use the included broker proxy server:

1. Create credentials
   - Get Alpaca Market Data API keys.
2. Configure env vars
   - Copy `server/.env.example` values into your shell env.
3. Start proxy
   - `node server/broker-proxy.js`
4. Test endpoints
   - `http://localhost:8787/health`
   - `http://localhost:8787/api/quote?ticker=AAPL`
   - `http://localhost:8787/api/candles?ticker=AAPL&timeframe=1Min&limit=390`

### Notes
- A backend proxy is strongly recommended so API keys are never exposed in `index.html`.
- A database is optional; add one if you want to cache/store historical bars for analytics and faster backtests.
