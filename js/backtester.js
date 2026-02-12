/**
 * Backtesting Engine
 *
 * Runs the ORB strategy across multiple days of historical data
 * and computes comprehensive performance metrics:
 * - Win rate, profit factor, expectancy
 * - Max drawdown, Sharpe ratio, Sortino ratio
 * - Equity curve, trade distribution
 * - Monte Carlo simulation for confidence intervals
 */

const Backtester = (() => {

  const DEFAULT_BACKTEST_CONFIG = {
    startingCapital: 100000,
    commission: 0.005,         // Per share commission
    slippage: 0.02,            // Slippage per trade ($)
    ticker: 'SPY',
    numDays: 60,               // Trading days to backtest
    startDate: '2025-11-01',
    strategyConfig: {},
  };

  // Run full backtest
  function run(config) {
    config = { ...DEFAULT_BACKTEST_CONFIG, ...config };
    const { startingCapital, commission, slippage, ticker, numDays, startDate, strategyConfig } = config;

    // Generate historical data
    const historicalDays = MarketData.generateHistoricalData(
      ticker,
      new Date(startDate),
      numDays,
      ticker.charCodeAt(0) * 31337
    );

    let equity = startingCapital;
    let peakEquity = startingCapital;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    const equityCurve = [{ day: 0, equity: startingCapital, date: startDate }];
    const allTrades = [];
    const dailyReturns = [];
    const dailyResults = [];

    for (let d = 0; d < historicalDays.length; d++) {
      const dayData = historicalDays[d];
      const result = ORBStrategy.runDay(dayData.candles, strategyConfig, equity);

      let dayPnL = 0;
      for (const trade of result.trades) {
        // Apply commission and slippage
        const totalShares = trade.shares;
        const commissionCost = totalShares * commission * 2; // Entry + exit
        const slippageCost = slippage * 2;
        const netPnL = trade.totalPnL - commissionCost - slippageCost;

        allTrades.push({
          ...trade,
          day: d + 1,
          date: dayData.date.toISOString().slice(0, 10),
          ticker: ticker,
          grossPnL: trade.totalPnL,
          commission: parseFloat(commissionCost.toFixed(2)),
          slippage: parseFloat(slippageCost.toFixed(2)),
          netPnL: parseFloat(netPnL.toFixed(2)),
          returnPct: parseFloat((netPnL / equity * 100).toFixed(4)),
        });
        dayPnL += netPnL;
      }

      equity += dayPnL;
      if (equity > peakEquity) peakEquity = equity;
      const drawdown = peakEquity - equity;
      const drawdownPct = peakEquity > 0 ? drawdown / peakEquity * 100 : 0;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      if (drawdownPct > maxDrawdownPercent) maxDrawdownPercent = drawdownPct;

      const dailyReturn = dayPnL / (equity - dayPnL) * 100;
      dailyReturns.push(dailyReturn);

      equityCurve.push({
        day: d + 1,
        equity: parseFloat(equity.toFixed(2)),
        date: dayData.date.toISOString().slice(0, 10),
        pnl: parseFloat(dayPnL.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2)),
        drawdownPct: parseFloat(drawdownPct.toFixed(2)),
        openingRange: result.openingRange ? {
          high: result.openingRange.high,
          low: result.openingRange.low,
          rangeSize: result.openingRange.rangeSize,
        } : null,
        trades: result.trades.length,
      });

      dailyResults.push({
        date: dayData.date.toISOString().slice(0, 10),
        trades: result.trades.length,
        pnl: parseFloat(dayPnL.toFixed(2)),
        openingRange: result.openingRange,
        signals: result.signals.length,
      });
    }

    // Compute metrics
    const metrics = computeMetrics(allTrades, equityCurve, dailyReturns, startingCapital);

    return {
      config,
      equityCurve,
      trades: allTrades,
      dailyResults,
      metrics,
      historicalDays,
    };
  }

  function computeMetrics(trades, equityCurve, dailyReturns, startingCapital) {
    const winners = trades.filter(t => t.netPnL > 0);
    const losers = trades.filter(t => t.netPnL <= 0);
    const totalPnL = trades.reduce((s, t) => s + t.netPnL, 0);
    const grossProfit = winners.reduce((s, t) => s + t.netPnL, 0);
    const grossLoss = Math.abs(losers.reduce((s, t) => s + t.netPnL, 0));

    // Drawdown calculations
    let maxDD = 0, maxDDPct = 0, peak = startingCapital;
    let currentDDStart = 0, longestDD = 0, ddStartDay = 0;
    for (const point of equityCurve) {
      if (point.equity >= peak) {
        peak = point.equity;
        const ddLength = point.day - ddStartDay;
        if (ddLength > longestDD) longestDD = ddLength;
        ddStartDay = point.day;
      }
      const dd = peak - point.equity;
      const ddPct = peak > 0 ? dd / peak * 100 : 0;
      if (dd > maxDD) maxDD = dd;
      if (ddPct > maxDDPct) maxDDPct = ddPct;
    }

    // Risk-adjusted returns
    const avgDailyReturn = dailyReturns.length > 0
      ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
    const stdDailyReturn = dailyReturns.length > 1
      ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / (dailyReturns.length - 1))
      : 0;
    const downsideReturns = dailyReturns.filter(r => r < 0);
    const downsideStd = downsideReturns.length > 1
      ? Math.sqrt(downsideReturns.reduce((s, r) => s + r ** 2, 0) / downsideReturns.length)
      : 0;

    const annualizedReturn = avgDailyReturn * 252;
    const annualizedStd = stdDailyReturn * Math.sqrt(252);
    const sharpeRatio = annualizedStd > 0 ? annualizedReturn / annualizedStd : 0;
    const sortinoRatio = downsideStd > 0 ? (avgDailyReturn * 252) / (downsideStd * Math.sqrt(252)) : 0;

    // Trade statistics
    const avgWin = winners.length > 0 ? grossProfit / winners.length : 0;
    const avgLoss = losers.length > 0 ? grossLoss / losers.length : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const expectancy = trades.length > 0 ? totalPnL / trades.length : 0;
    const winRate = trades.length > 0 ? winners.length / trades.length * 100 : 0;

    // Consecutive wins/losses
    let maxConsecWins = 0, maxConsecLosses = 0, consecWins = 0, consecLosses = 0;
    for (const t of trades) {
      if (t.netPnL > 0) {
        consecWins++;
        consecLosses = 0;
        if (consecWins > maxConsecWins) maxConsecWins = consecWins;
      } else {
        consecLosses++;
        consecWins = 0;
        if (consecLosses > maxConsecLosses) maxConsecLosses = consecLosses;
      }
    }

    // Trade duration stats
    const durations = trades.map(t => t.durationMinutes).filter(d => d != null);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Average holding per direction
    const longTrades = trades.filter(t => t.direction === 'LONG');
    const shortTrades = trades.filter(t => t.direction === 'SHORT');

    return {
      totalTrades: trades.length,
      winners: winners.length,
      losers: losers.length,
      winRate: parseFloat(winRate.toFixed(1)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      expectancy: parseFloat(expectancy.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      largestWin: winners.length > 0 ? parseFloat(Math.max(...winners.map(t => t.netPnL)).toFixed(2)) : 0,
      largestLoss: losers.length > 0 ? parseFloat(Math.min(...losers.map(t => t.netPnL)).toFixed(2)) : 0,
      maxDrawdown: parseFloat(maxDD.toFixed(2)),
      maxDrawdownPct: parseFloat(maxDDPct.toFixed(2)),
      longestDrawdownDays: longestDD,
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      sortinoRatio: parseFloat(sortinoRatio.toFixed(2)),
      annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
      maxConsecWins,
      maxConsecLosses,
      avgDuration: parseFloat(avgDuration.toFixed(0)),
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      longWinRate: longTrades.length > 0
        ? parseFloat((longTrades.filter(t => t.netPnL > 0).length / longTrades.length * 100).toFixed(1)) : 0,
      shortWinRate: shortTrades.length > 0
        ? parseFloat((shortTrades.filter(t => t.netPnL > 0).length / shortTrades.length * 100).toFixed(1)) : 0,
      avgWinLossRatio: avgLoss > 0 ? parseFloat((avgWin / avgLoss).toFixed(2)) : 0,
      finalEquity: equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0,
      totalReturn: equityCurve.length > 0
        ? parseFloat(((equityCurve[equityCurve.length - 1].equity - startingCapital) / startingCapital * 100).toFixed(2)) : 0,
    };
  }

  // Monte Carlo simulation for confidence intervals
  function monteCarloSimulation(trades, startingCapital, numSimulations = 1000) {
    if (trades.length === 0) return null;
    const results = [];
    const rng = MarketData.seededRandom(42);

    for (let sim = 0; sim < numSimulations; sim++) {
      let equity = startingCapital;
      let peak = startingCapital;
      let maxDD = 0;

      // Randomly resample trades with replacement
      for (let i = 0; i < trades.length; i++) {
        const idx = Math.floor(rng() * trades.length);
        equity += trades[idx].netPnL;
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak * 100;
        if (dd > maxDD) maxDD = dd;
      }

      results.push({
        finalEquity: parseFloat(equity.toFixed(2)),
        totalReturn: parseFloat(((equity - startingCapital) / startingCapital * 100).toFixed(2)),
        maxDrawdown: parseFloat(maxDD.toFixed(2)),
      });
    }

    results.sort((a, b) => a.finalEquity - b.finalEquity);

    return {
      median: results[Math.floor(numSimulations * 0.5)],
      percentile5: results[Math.floor(numSimulations * 0.05)],
      percentile25: results[Math.floor(numSimulations * 0.25)],
      percentile75: results[Math.floor(numSimulations * 0.75)],
      percentile95: results[Math.floor(numSimulations * 0.95)],
      worstCase: results[0],
      bestCase: results[numSimulations - 1],
    };
  }

  return {
    DEFAULT_BACKTEST_CONFIG,
    run,
    computeMetrics,
    monteCarloSimulation,
  };
})();

if (typeof module !== 'undefined') module.exports = Backtester;
