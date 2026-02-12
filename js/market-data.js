/**
 * Market Data Engine
 * Generates realistic intraday stock data with proper market microstructure
 * Includes pre-market, opening range, regular hours, and after-hours data
 */

const MarketData = (() => {
  // Major stock tickers with realistic base prices and volatility profiles
  const STOCK_PROFILES = {
    AAPL: { name: 'Apple Inc.', basePrice: 189.50, volatility: 0.018, avgVolume: 55000000, sector: 'Technology' },
    MSFT: { name: 'Microsoft Corp.', basePrice: 415.20, volatility: 0.016, avgVolume: 22000000, sector: 'Technology' },
    GOOGL: { name: 'Alphabet Inc.', basePrice: 175.80, volatility: 0.020, avgVolume: 25000000, sector: 'Technology' },
    AMZN: { name: 'Amazon.com Inc.', basePrice: 198.40, volatility: 0.022, avgVolume: 48000000, sector: 'Consumer Cyclical' },
    TSLA: { name: 'Tesla Inc.', basePrice: 245.60, volatility: 0.035, avgVolume: 95000000, sector: 'Automotive' },
    NVDA: { name: 'NVIDIA Corp.', basePrice: 875.30, volatility: 0.030, avgVolume: 42000000, sector: 'Technology' },
    META: { name: 'Meta Platforms', basePrice: 505.10, volatility: 0.024, avgVolume: 18000000, sector: 'Technology' },
    JPM: { name: 'JPMorgan Chase', basePrice: 198.70, volatility: 0.014, avgVolume: 10000000, sector: 'Financial' },
    SPY: { name: 'S&P 500 ETF', basePrice: 512.40, volatility: 0.010, avgVolume: 75000000, sector: 'ETF' },
    QQQ: { name: 'Nasdaq 100 ETF', basePrice: 438.90, volatility: 0.013, avgVolume: 45000000, sector: 'ETF' },
  };

  // Seeded random for reproducible backtesting
  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (s >>> 0) / 0xFFFFFFFF;
    };
  }

  // Box-Muller transform for normal distribution
  function normalRandom(rng) {
    let u1 = rng();
    let u2 = rng();
    while (u1 === 0) u1 = rng();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  // Generate realistic intraday volume profile (U-shaped)
  function volumeProfile(minuteOfDay, totalMinutes) {
    const t = minuteOfDay / totalMinutes;
    // U-shaped volume curve: high at open and close, low midday
    const openWeight = Math.exp(-8 * t) * 3;
    const closeWeight = Math.exp(-8 * (1 - t)) * 2.5;
    const baseWeight = 0.4;
    return openWeight + closeWeight + baseWeight;
  }

  // Generate a single day of intraday candle data (1-minute bars)
  function generateIntradayData(ticker, date, seed, prevClose) {
    const profile = STOCK_PROFILES[ticker];
    if (!profile) return null;
    const rng = seededRandom(seed);
    const basePrice = prevClose || profile.basePrice;
    const vol = profile.volatility;

    // Pre-market gap (overnight sentiment)
    const gapPercent = normalRandom(rng) * vol * 0.6;
    let currentPrice = basePrice * (1 + gapPercent);
    const openPrice = currentPrice;

    const candles = [];
    const totalMinutes = 390; // 6.5 hours of trading
    const startTime = new Date(date);
    startTime.setHours(9, 30, 0, 0);

    // Intraday trend bias
    const trendBias = normalRandom(rng) * vol * 0.3;
    // Mean reversion strength
    const meanRevStrength = 0.02;

    // Track opening range high/low for volume spikes on breakout
    let orHigh = -Infinity;
    let orLow = Infinity;
    const orPeriod = 15; // Match default ORB opening range

    for (let i = 0; i < totalMinutes; i++) {
      const time = new Date(startTime.getTime() + i * 60000);
      const volMultiplier = volumeProfile(i, totalMinutes);

      // Price movement with mean reversion and trend
      const minuteVol = vol / Math.sqrt(totalMinutes);
      const noise = normalRandom(rng) * minuteVol * volMultiplier * 0.5;
      const trend = trendBias / totalMinutes;
      const meanRev = meanRevStrength * (openPrice - currentPrice) / openPrice * minuteVol;

      const priceChange = noise + trend + meanRev;
      const open = currentPrice;
      const intraHigh = open * (1 + Math.abs(normalRandom(rng) * minuteVol * 0.3));
      const intraLow = open * (1 - Math.abs(normalRandom(rng) * minuteVol * 0.3));
      currentPrice = open * (1 + priceChange);
      const close = currentPrice;

      const high = Math.max(open, close, intraHigh);
      const low = Math.min(open, close, intraLow);

      // Track opening range levels
      if (i < orPeriod) {
        if (high > orHigh) orHigh = high;
        if (low < orLow) orLow = low;
      }

      // Volume with U-shape profile + randomness
      let baseVol = (profile.avgVolume / totalMinutes) * volMultiplier;

      // Spike volume on breakout candles (price crossing OR high/low)
      if (i >= orPeriod && orHigh !== -Infinity) {
        if (high > orHigh || low < orLow) {
          baseVol *= 1.8 + rng() * 1.2; // 1.8x-3.0x spike on breakout
        }
      }

      const volume = Math.round(baseVol * (0.5 + rng()));

      candles.push({
        time: time.getTime(),
        timeStr: time.toISOString(),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume,
      });
    }

    return {
      ticker,
      date: date,
      preMarketGap: gapPercent,
      openPrice: parseFloat(openPrice.toFixed(2)),
      closePrice: parseFloat(currentPrice.toFixed(2)),
      candles,
    };
  }

  // Generate multiple days of historical data for backtesting
  function generateHistoricalData(ticker, startDate, numDays, baseSeed) {
    const days = [];
    let currentDate = new Date(startDate);
    let prevClose = STOCK_PROFILES[ticker]?.basePrice;
    let seed = baseSeed || (ticker.charCodeAt(0) * 10000 + ticker.charCodeAt(1) * 100);

    for (let d = 0; d < numDays; d++) {
      // Skip weekends
      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        currentDate = new Date(currentDate.getTime() + 86400000);
      }

      seed = seed * 1103515245 + 12345;
      const dayData = generateIntradayData(ticker, new Date(currentDate), seed, prevClose);
      if (dayData) {
        days.push(dayData);
        prevClose = dayData.closePrice;
      }

      currentDate = new Date(currentDate.getTime() + 86400000);
    }

    return days;
  }

  // Generate pre-market data (4:00 AM - 9:30 AM, sparse)
  function generatePreMarketData(ticker, date, seed, prevClose) {
    const profile = STOCK_PROFILES[ticker];
    if (!profile) return [];
    const rng = seededRandom(seed + 999);
    const basePrice = prevClose || profile.basePrice;

    const preMarketCandles = [];
    const startTime = new Date(date);
    startTime.setHours(4, 0, 0, 0);
    let currentPrice = basePrice;

    // Pre-market: 330 minutes, but very sparse trading
    for (let i = 0; i < 330; i += 5) { // 5-minute bars
      const time = new Date(startTime.getTime() + i * 60000);
      const noise = normalRandom(rng) * profile.volatility * 0.005;
      const open = currentPrice;
      currentPrice = open * (1 + noise);
      const close = currentPrice;
      const high = Math.max(open, close) * (1 + Math.abs(normalRandom(rng) * 0.001));
      const low = Math.min(open, close) * (1 - Math.abs(normalRandom(rng) * 0.001));
      const volume = Math.round(profile.avgVolume * 0.001 * rng());

      preMarketCandles.push({
        time: time.getTime(),
        timeStr: time.toISOString(),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });
    }

    return preMarketCandles;
  }

  // Real-time tick simulation
  function createTickSimulator(ticker, startPrice, speedMultiplier = 1) {
    const profile = STOCK_PROFILES[ticker];
    if (!profile) return null;

    let currentPrice = startPrice || profile.basePrice;
    let tickCount = 0;
    const rng = seededRandom(Date.now());

    return {
      nextTick() {
        tickCount++;
        const noise = normalRandom(rng) * profile.volatility * 0.001;
        currentPrice = currentPrice * (1 + noise);
        const spread = currentPrice * 0.0002; // Typical spread
        return {
          price: parseFloat(currentPrice.toFixed(2)),
          bid: parseFloat((currentPrice - spread / 2).toFixed(2)),
          ask: parseFloat((currentPrice + spread / 2).toFixed(2)),
          volume: Math.round(100 + rng() * 500),
          timestamp: Date.now(),
          tickNumber: tickCount,
        };
      },
      getCurrentPrice() {
        return parseFloat(currentPrice.toFixed(2));
      }
    };
  }

  return {
    STOCK_PROFILES,
    generateIntradayData,
    generateHistoricalData,
    generatePreMarketData,
    createTickSimulator,
    seededRandom,
    normalRandom,
  };
})();

if (typeof module !== 'undefined') module.exports = MarketData;
