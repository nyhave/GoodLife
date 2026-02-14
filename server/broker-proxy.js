#!/usr/bin/env node
/**
 * Lightweight broker data proxy for ORB Trading System.
 *
 * Why this exists:
 * - Keeps broker API keys off the client.
 * - Normalizes quote/bar payloads for the front-end.
 *
 * Environment variables:
 * - PORT (default: 8787)
 * - ALPACA_KEY_ID (required)
 * - ALPACA_SECRET_KEY (required)
 * - ALPACA_BASE_URL (optional, default: https://data.alpaca.markets)
 */

const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 8787);
const ALPACA_KEY_ID = process.env.ALPACA_KEY_ID;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const ALPACA_BASE_URL = process.env.ALPACA_BASE_URL || 'https://data.alpaca.markets';

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function getTicker(urlObj) {
  const raw = (urlObj.searchParams.get('ticker') || '').trim().toUpperCase();
  if (!/^[A-Z.]{1,10}$/.test(raw)) return null;
  return raw;
}

function authHeaders() {
  return {
    'APCA-API-KEY-ID': ALPACA_KEY_ID,
    'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
    'Content-Type': 'application/json',
  };
}

async function fetchJson(url, headers) {
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upstream ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function handleQuote(urlObj, res) {
  const ticker = getTicker(urlObj);
  if (!ticker) return json(res, 400, { error: 'Invalid ticker' });

  if (!ALPACA_KEY_ID || !ALPACA_SECRET_KEY) {
    return json(res, 500, { error: 'Missing ALPACA_KEY_ID/ALPACA_SECRET_KEY' });
  }

  try {
    const latestQuoteUrl = `${ALPACA_BASE_URL}/v2/stocks/${encodeURIComponent(ticker)}/quotes/latest`;
    const latestBarUrl = `${ALPACA_BASE_URL}/v2/stocks/${encodeURIComponent(ticker)}/bars/latest`;

    const [quotePayload, barPayload] = await Promise.all([
      fetchJson(latestQuoteUrl, authHeaders()),
      fetchJson(latestBarUrl, authHeaders()),
    ]);

    const q = quotePayload.quote || {};
    const b = barPayload.bar || {};

    return json(res, 200, {
      ticker,
      bid: q.bp ?? null,
      ask: q.ap ?? null,
      price: b.c ?? (q.ap && q.bp ? (q.ap + q.bp) / 2 : null),
      open: b.o ?? null,
      high: b.h ?? null,
      low: b.l ?? null,
      volume: b.v ?? null,
      timestamp: b.t || q.t || new Date().toISOString(),
      source: 'alpaca',
    });
  } catch (err) {
    return json(res, 502, { error: 'Failed to fetch quote', detail: String(err.message || err) });
  }
}

async function handleCandles(urlObj, res) {
  const ticker = getTicker(urlObj);
  if (!ticker) return json(res, 400, { error: 'Invalid ticker' });

  if (!ALPACA_KEY_ID || !ALPACA_SECRET_KEY) {
    return json(res, 500, { error: 'Missing ALPACA_KEY_ID/ALPACA_SECRET_KEY' });
  }

  const timeframe = (urlObj.searchParams.get('timeframe') || '1Min').trim();
  const limit = Math.max(1, Math.min(1000, Number(urlObj.searchParams.get('limit') || 390)));

  try {
    const barsUrl = new URL(`${ALPACA_BASE_URL}/v2/stocks/${encodeURIComponent(ticker)}/bars`);
    barsUrl.searchParams.set('timeframe', timeframe);
    barsUrl.searchParams.set('limit', String(limit));
    barsUrl.searchParams.set('adjustment', 'raw');
    barsUrl.searchParams.set('feed', 'iex');

    const payload = await fetchJson(barsUrl.toString(), authHeaders());
    const bars = Array.isArray(payload.bars) ? payload.bars : [];

    return json(res, 200, {
      ticker,
      candles: bars.map((b) => ({
        time: new Date(b.t).getTime(),
        timeStr: b.t,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
      })),
      source: 'alpaca',
    });
  } catch (err) {
    return json(res, 502, { error: 'Failed to fetch candles', detail: String(err.message || err) });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) return json(res, 400, { error: 'Bad request' });

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

  if (req.method === 'GET' && urlObj.pathname === '/health') {
    return json(res, 200, { ok: true, service: 'broker-proxy' });
  }
  if (req.method === 'GET' && urlObj.pathname === '/api/quote') {
    return handleQuote(urlObj, res);
  }
  if (req.method === 'GET' && urlObj.pathname === '/api/candles') {
    return handleCandles(urlObj, res);
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[broker-proxy] listening on http://localhost:${PORT}`);
});
