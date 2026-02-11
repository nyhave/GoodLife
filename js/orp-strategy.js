/**
 * ORP (Opening Range Protocol) Strategy Engine
 *
 * The Opening Range Breakout (ORB/ORP) strategy:
 * 1. Defines an "opening range" from the first N minutes of trading
 * 2. Enters LONG when price breaks above the opening range high
 * 3. Enters SHORT when price breaks below the opening range low
 * 4. Uses the opposite side of the range as a stop loss
 * 5. Targets multiples of the range size for profit taking
 *
 * Configurable parameters:
 * - Opening range period (5, 15, 30 minutes)
 * - Breakout confirmation (close above/below vs wick)
 * - Volume confirmation threshold
 * - Risk/reward targets
 * - Trailing stop options
 * - Max trades per day
 */

const ORPStrategy = (() => {

  const DEFAULT_CONFIG = {
    openingRangeMinutes: 15,        // First N minutes define the range
    confirmationType: 'close',       // 'close' = candle close above/below, 'wick' = any wick breach
    volumeConfirmation: true,        // Require above-average volume on breakout
    volumeMultiplier: 1.5,           // Volume must be N x average volume during OR
    riskRewardTargets: [1.5, 2.0, 3.0], // Take profit at Nx range size
    positionSizing: 'fixed_risk',    // 'fixed_risk' or 'fixed_shares'
    riskPerTrade: 0.02,              // Risk 2% of account per trade
    maxTradesPerDay: 2,              // Maximum trades per day
    trailingStop: true,              // Enable trailing stop
    trailingStopActivation: 1.0,     // Activate trailing after 1x range profit
    trailingStopDistance: 0.5,       // Trail by 0.5x range
    usePartialProfits: true,         // Scale out at targets
    partialProfitPercents: [0.33, 0.33, 0.34], // % of position to close at each target
    maxHoldingMinutes: 300,          // Max time in trade (5 hours)
    avoidFirstMinutes: 0,            // Skip first N minutes after range forms
    stopLossBuffer: 0.10,            // Extra buffer below/above range for stop ($)
    breakEvenAfterTarget1: true,     // Move stop to break-even after first target hit
  };

  // Compute the opening range from candle data
  function computeOpeningRange(candles, config) {
    const orCandles = candles.slice(0, config.openingRangeMinutes);
    if (orCandles.length < config.openingRangeMinutes) return null;

    let high = -Infinity;
    let low = Infinity;
    let totalVolume = 0;

    for (const c of orCandles) {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      totalVolume += c.volume;
    }

    const rangeSize = high - low;
    const avgVolume = totalVolume / orCandles.length;
    const midpoint = (high + low) / 2;
    const rangeEndTime = orCandles[orCandles.length - 1].time;

    return {
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      rangeSize: parseFloat(rangeSize.toFixed(2)),
      midpoint: parseFloat(midpoint.toFixed(2)),
      avgVolume: Math.round(avgVolume),
      totalVolume,
      rangeEndTime,
      openPrice: orCandles[0].open,
      orCandles,
    };
  }

  // Calculate position size based on risk
  function calculatePositionSize(accountSize, riskPercent, entryPrice, stopPrice) {
    const riskAmount = accountSize * riskPercent;
    const riskPerShare = Math.abs(entryPrice - stopPrice);
    if (riskPerShare <= 0) return 0;
    return Math.floor(riskAmount / riskPerShare);
  }

  // Run ORP strategy on a single day's data
  function runDay(candles, config, accountSize) {
    config = { ...DEFAULT_CONFIG, ...config };
    const or = computeOpeningRange(candles, config);
    if (!or) return { trades: [], openingRange: null, signals: [] };

    const signals = [];
    const trades = [];
    let activeTrade = null;
    let tradesCount = 0;

    // Process candles after opening range
    const startIdx = config.openingRangeMinutes + config.avoidFirstMinutes;

    for (let i = startIdx; i < candles.length; i++) {
      const candle = candles[i];
      const minutesInTrade = activeTrade ? (candle.time - activeTrade.entryTime) / 60000 : 0;

      // Check for exit conditions on active trade
      if (activeTrade) {
        const trade = activeTrade;
        let exitPrice = null;
        let exitReason = '';

        // Check stop loss
        if (trade.direction === 'LONG') {
          if (candle.low <= trade.currentStop) {
            exitPrice = trade.currentStop;
            exitReason = 'Stop Loss';
          }
        } else {
          if (candle.high >= trade.currentStop) {
            exitPrice = trade.currentStop;
            exitReason = 'Stop Loss';
          }
        }

        // Check max holding time
        if (!exitPrice && minutesInTrade >= config.maxHoldingMinutes) {
          exitPrice = candle.close;
          exitReason = 'Max Time';
        }

        // Check partial profit targets
        if (!exitPrice && config.usePartialProfits) {
          for (let t = trade.nextTargetIdx; t < config.riskRewardTargets.length; t++) {
            const targetMultiple = config.riskRewardTargets[t];
            const targetPrice = trade.direction === 'LONG'
              ? trade.entryPrice + or.rangeSize * targetMultiple
              : trade.entryPrice - or.rangeSize * targetMultiple;

            if ((trade.direction === 'LONG' && candle.high >= targetPrice) ||
                (trade.direction === 'SHORT' && candle.low <= targetPrice)) {

              const partialPct = config.partialProfitPercents[t] || 0;
              const sharesToClose = Math.floor(trade.remainingShares * partialPct /
                (config.partialProfitPercents.slice(t).reduce((a, b) => a + b, 0) || 1));

              if (sharesToClose > 0) {
                trade.partialExits.push({
                  time: candle.time,
                  price: parseFloat(targetPrice.toFixed(2)),
                  shares: sharesToClose,
                  target: t + 1,
                  pnl: parseFloat(((trade.direction === 'LONG' ? 1 : -1) *
                    (targetPrice - trade.entryPrice) * sharesToClose).toFixed(2)),
                });
                trade.remainingShares -= sharesToClose;
                trade.nextTargetIdx = t + 1;

                signals.push({
                  time: candle.time,
                  type: 'PARTIAL_EXIT',
                  price: targetPrice,
                  target: t + 1,
                  shares: sharesToClose,
                });

                // Move stop to break-even after first target
                if (t === 0 && config.breakEvenAfterTarget1) {
                  trade.currentStop = trade.entryPrice;
                }
              }
            }
          }
        }

        // Trailing stop update
        if (!exitPrice && config.trailingStop && !config.usePartialProfits) {
          const profitMultiple = trade.direction === 'LONG'
            ? (candle.high - trade.entryPrice) / or.rangeSize
            : (trade.entryPrice - candle.low) / or.rangeSize;

          if (profitMultiple >= config.trailingStopActivation) {
            const trailDistance = or.rangeSize * config.trailingStopDistance;
            const newStop = trade.direction === 'LONG'
              ? candle.high - trailDistance
              : candle.low + trailDistance;

            if (trade.direction === 'LONG' && newStop > trade.currentStop) {
              trade.currentStop = parseFloat(newStop.toFixed(2));
            } else if (trade.direction === 'SHORT' && newStop < trade.currentStop) {
              trade.currentStop = parseFloat(newStop.toFixed(2));
            }
          }
        }

        // Close remaining position
        if (exitPrice || trade.remainingShares <= 0) {
          if (trade.remainingShares > 0 && exitPrice) {
            trade.partialExits.push({
              time: candle.time,
              price: parseFloat(exitPrice.toFixed(2)),
              shares: trade.remainingShares,
              target: -1,
              pnl: parseFloat(((trade.direction === 'LONG' ? 1 : -1) *
                (exitPrice - trade.entryPrice) * trade.remainingShares).toFixed(2)),
            });
            trade.remainingShares = 0;
          }

          trade.exitTime = candle.time;
          trade.exitReason = exitReason || 'Targets Hit';
          trade.totalPnL = parseFloat(
            trade.partialExits.reduce((sum, pe) => sum + pe.pnl, 0).toFixed(2)
          );
          trade.durationMinutes = Math.round((candle.time - trade.entryTime) / 60000);
          trade.maxFavorableExcursion = trade.mfe;
          trade.maxAdverseExcursion = trade.mae;
          trades.push({ ...trade });
          activeTrade = null;

          signals.push({
            time: candle.time,
            type: 'EXIT',
            direction: trade.direction,
            price: exitPrice || candle.close,
            reason: trade.exitReason,
            pnl: trade.totalPnL,
          });
        } else {
          // Track MFE/MAE
          if (trade.direction === 'LONG') {
            trade.mfe = Math.max(trade.mfe || 0, candle.high - trade.entryPrice);
            trade.mae = Math.max(trade.mae || 0, trade.entryPrice - candle.low);
          } else {
            trade.mfe = Math.max(trade.mfe || 0, trade.entryPrice - candle.low);
            trade.mae = Math.max(trade.mae || 0, candle.high - trade.entryPrice);
          }
        }

        continue;
      }

      // Look for new entry signals (only if no active trade)
      if (tradesCount >= config.maxTradesPerDay) continue;

      // Volume confirmation
      const volumeOk = !config.volumeConfirmation ||
        candle.volume >= or.avgVolume * config.volumeMultiplier;

      // LONG breakout
      const longBreak = config.confirmationType === 'close'
        ? candle.close > or.high
        : candle.high > or.high;

      // SHORT breakout
      const shortBreak = config.confirmationType === 'close'
        ? candle.close < or.low
        : candle.low < or.low;

      if (longBreak && volumeOk) {
        const entryPrice = config.confirmationType === 'close' ? candle.close : or.high + 0.01;
        const stopPrice = or.low - config.stopLossBuffer;
        const shares = config.positionSizing === 'fixed_risk'
          ? calculatePositionSize(accountSize, config.riskPerTrade, entryPrice, stopPrice)
          : 100;

        if (shares > 0) {
          activeTrade = {
            direction: 'LONG',
            entryPrice: parseFloat(entryPrice.toFixed(2)),
            entryTime: candle.time,
            stopLoss: parseFloat(stopPrice.toFixed(2)),
            currentStop: parseFloat(stopPrice.toFixed(2)),
            shares,
            remainingShares: shares,
            partialExits: [],
            nextTargetIdx: 0,
            mfe: 0,
            mae: 0,
          };
          tradesCount++;

          signals.push({
            time: candle.time,
            type: 'ENTRY',
            direction: 'LONG',
            price: entryPrice,
            stop: stopPrice,
            shares,
            reason: `Breakout above OR high ${or.high}`,
          });
        }
      } else if (shortBreak && volumeOk) {
        const entryPrice = config.confirmationType === 'close' ? candle.close : or.low - 0.01;
        const stopPrice = or.high + config.stopLossBuffer;
        const shares = config.positionSizing === 'fixed_risk'
          ? calculatePositionSize(accountSize, config.riskPerTrade, entryPrice, stopPrice)
          : 100;

        if (shares > 0) {
          activeTrade = {
            direction: 'SHORT',
            entryPrice: parseFloat(entryPrice.toFixed(2)),
            entryTime: candle.time,
            stopLoss: parseFloat(stopPrice.toFixed(2)),
            currentStop: parseFloat(stopPrice.toFixed(2)),
            shares,
            remainingShares: shares,
            partialExits: [],
            nextTargetIdx: 0,
            mfe: 0,
            mae: 0,
          };
          tradesCount++;

          signals.push({
            time: candle.time,
            type: 'ENTRY',
            direction: 'SHORT',
            price: entryPrice,
            stop: stopPrice,
            shares,
            reason: `Breakdown below OR low ${or.low}`,
          });
        }
      }
    }

    // Close any open trade at end of day
    if (activeTrade) {
      const lastCandle = candles[candles.length - 1];
      const exitPrice = lastCandle.close;
      activeTrade.partialExits.push({
        time: lastCandle.time,
        price: exitPrice,
        shares: activeTrade.remainingShares,
        target: -1,
        pnl: parseFloat(((activeTrade.direction === 'LONG' ? 1 : -1) *
          (exitPrice - activeTrade.entryPrice) * activeTrade.remainingShares).toFixed(2)),
      });
      activeTrade.remainingShares = 0;
      activeTrade.exitTime = lastCandle.time;
      activeTrade.exitReason = 'End of Day';
      activeTrade.totalPnL = parseFloat(
        activeTrade.partialExits.reduce((sum, pe) => sum + pe.pnl, 0).toFixed(2)
      );
      activeTrade.durationMinutes = Math.round((lastCandle.time - activeTrade.entryTime) / 60000);
      trades.push({ ...activeTrade });
      activeTrade = null;
    }

    return {
      trades,
      openingRange: or,
      signals,
      summary: {
        totalTrades: trades.length,
        winners: trades.filter(t => t.totalPnL > 0).length,
        losers: trades.filter(t => t.totalPnL <= 0).length,
        totalPnL: parseFloat(trades.reduce((s, t) => s + t.totalPnL, 0).toFixed(2)),
        rangeSize: or.rangeSize,
        rangePercent: parseFloat((or.rangeSize / or.openPrice * 100).toFixed(3)),
      }
    };
  }

  return {
    DEFAULT_CONFIG,
    computeOpeningRange,
    calculatePositionSize,
    runDay,
  };
})();

if (typeof module !== 'undefined') module.exports = ORPStrategy;
