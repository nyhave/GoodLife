# ORP Trading System

An Opening Range Protocol (ORP) day trading application with backtesting, sentiment analysis, and a real-time simulation dashboard. Built with React (CDN) and requires no build step.

## Features

- **ORP Strategy Engine** - Configurable Opening Range Breakout strategy with partial profits, trailing stops, and volume confirmation
- **Backtesting** - Test the strategy across 60+ days of generated historical data with full metrics (Sharpe, Sortino, profit factor, Monte Carlo simulation)
- **Pre-Market Sentiment Analysis** - News, social media, options flow, gap analysis, and analyst ratings aggregated into a composite score
- **Live Simulation Dashboard** - Watch the trading day unfold minute-by-minute with candlestick charts, opening range overlay, trade signals, and risk monitoring
- **10 Tickers** - SPY, QQQ, AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META, JPM

## Usage

Open `index.html` in your browser. No server or build step required.

## Tabs

- **Dashboard** - Main trading view with chart, simulation controls, risk monitor, and trade log
- **Sentiment** - Pre-market sentiment rankings and detailed analysis per ticker
- **Backtest** - Configure and run historical backtests with equity curves and performance metrics
- **Strategy** - View and modify ORP strategy parameters and rules
