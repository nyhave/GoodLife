#!/usr/bin/env node
// ─── Fetch Real AAPL Data from Yahoo Finance ───────────────────
// Usage:  node fetch-data.js
//         node fetch-data.js TSLA
//         node fetch-data.js AAPL 30   (last 30 days)
//
// Saves daily OHLCV data to data/<ticker>-daily.json
// Requires: Node.js 18+ (uses built-in fetch)

const ticker = (process.argv[2] || 'AAPL').toUpperCase();
const days = parseInt(process.argv[3] || '10', 10);
const fs = require('fs');
const path = require('path');

async function fetchYahoo(ticker, days) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${from}&period2=${now}&interval=1d&includePrePost=false`;

  console.log(`Fetching ${ticker} daily data (last ${days} days)...`);
  console.log(`URL: ${url}\n`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance returned HTTP ${res.status}. Try again in a few minutes.`);
  }

  const json = await res.json();
  const result = json.chart.result[0];
  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];

  const tradingDays = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (quote.open[i] == null) continue;
    const d = new Date(timestamps[i] * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const prevClose = i > 0 && quote.close[i - 1] != null ? quote.close[i - 1] : quote.open[i];
    const change = ((quote.close[i] - prevClose) / prevClose * 100);

    tradingDays.push({
      date: dateStr,
      open: Math.round(quote.open[i] * 100) / 100,
      high: Math.round(quote.high[i] * 100) / 100,
      low: Math.round(quote.low[i] * 100) / 100,
      close: Math.round(quote.close[i] * 100) / 100,
      volume: quote.volume[i],
      change: Math.round(change * 100) / 100,
      notes: ''
    });
  }

  return tradingDays;
}

async function main() {
  try {
    const tradingDays = await fetchYahoo(ticker, days);
    if (tradingDays.length === 0) {
      console.error('No data returned. Check ticker symbol.');
      process.exit(1);
    }

    const output = {
      ticker,
      source: `Yahoo Finance API — fetched ${new Date().toISOString()}`,
      note: 'Run "node fetch-data.js" to refresh',
      days: tradingDays
    };

    const dir = path.join(__dirname, 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const outPath = path.join(dir, `${ticker.toLowerCase()}-daily.json`);
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`Saved ${tradingDays.length} trading days to ${outPath}\n`);
    console.log('Date        Open      High      Low       Close     Volume       Change');
    console.log('─'.repeat(80));
    for (const d of tradingDays) {
      console.log(
        `${d.date}  $${d.open.toFixed(2).padStart(7)}  $${d.high.toFixed(2).padStart(7)}  ` +
        `$${d.low.toFixed(2).padStart(7)}  $${d.close.toFixed(2).padStart(7)}  ` +
        `${(d.volume / 1e6).toFixed(1).padStart(6)}M  ${d.change >= 0 ? '+' : ''}${d.change.toFixed(2)}%`
      );
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
