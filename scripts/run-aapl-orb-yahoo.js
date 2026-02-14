#!/usr/bin/env node

const ORBStrategy = require('../js/orb-strategy');

const YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=5d&interval=1m&includePrePost=false&events=div%2Csplits';

function formatNyDate(timestampMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestampMs));

  const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isRegularSessionMinute(timestampMs) {
  const estTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestampMs));

  return estTime >= '09:30' && estTime <= '16:00';
}

async function fetchYahooCandles() {
  const response = await fetch(YAHOO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ORB-Simulator/1.0)',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed (${response.status} ${response.statusText})`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error('Unexpected Yahoo Finance payload: missing chart.result[0]');
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const candlesByDay = new Map();

  for (let i = 0; i < timestamps.length; i++) {
    const tsMs = timestamps[i] * 1000;
    const open = opens[i];
    const high = highs[i];
    const low = lows[i];
    const close = closes[i];
    const volume = volumes[i];

    if ([open, high, low, close, volume].some(v => v == null) || !isRegularSessionMinute(tsMs)) {
      continue;
    }

    const dateKey = formatNyDate(tsMs);
    if (!candlesByDay.has(dateKey)) candlesByDay.set(dateKey, []);

    candlesByDay.get(dateKey).push({
      time: tsMs,
      timeStr: new Date(tsMs).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(volume),
    });
  }

  const completeDays = [...candlesByDay.entries()]
    .filter(([, candles]) => candles.length >= 300)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (completeDays.length === 0) {
    throw new Error('No complete regular-session AAPL day found in Yahoo data window.');
  }

  const [day, candles] = completeDays[completeDays.length - 1];
  candles.sort((a, b) => a.time - b.time);

  return { day, candles };
}

function summarizeTrades(result) {
  if (result.trades.length === 0) return 'No trades generated for this session/config.';

  return result.trades.map((trade, index) => {
    const entry = new Date(trade.entryTime).toISOString();
    const exit = new Date(trade.exitTime).toISOString();
    return `${index + 1}. ${trade.direction} | Entry ${trade.entryPrice} @ ${entry} | Exit ${trade.exitReason} @ ${exit} | Shares ${trade.shares} | PnL ${trade.totalPnL.toFixed(2)}`;
  }).join('\n');
}

async function main() {
  const { day, candles } = await fetchYahooCandles();

  const config = {
    openingRangeMinutes: 15,
    confirmationType: 'close',
    volumeConfirmation: false,
    vwapConfirmation: false,
    sentimentConfirmation: false,
    minConfirmations: 0,
    maxTradesPerDay: 2,
  };

  const simulation = ORBStrategy.runDay(candles, config, 100000, null, 0);

  console.log('AAPL ORB one-time simulation (Yahoo Finance 1m data)');
  console.log(`Date (America/New_York): ${day}`);
  console.log(`Candles used: ${candles.length}`);
  console.log(`Opening Range: High ${simulation.openingRange?.high} | Low ${simulation.openingRange?.low} | Size ${simulation.openingRange?.rangeSize}`);
  console.log(`Trades: ${simulation.summary.totalTrades} | Winners: ${simulation.summary.winners} | Losers: ${simulation.summary.losers} | Total PnL: ${simulation.summary.totalPnL}`);
  console.log('Trade details:');
  console.log(summarizeTrades(simulation));
}

main().catch((error) => {
  console.error('Failed to run Yahoo Finance ORB simulation:', error.message);
  process.exit(1);
});
