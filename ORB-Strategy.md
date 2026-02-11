# Opening Range Breakout (ORB) Trading Strategy

## What Is the Opening Range?

The **opening range** is the price range established during the first few minutes of the regular trading session (9:30 AM ET for U.S. equities). Traders typically use the first **5, 15, or 30 minutes** to define this range. The highest price reached during that window becomes the **opening range high**, and the lowest price becomes the **opening range low**.

This narrow window captures the initial battle between buyers and sellers as overnight orders, pre-market sentiment, and institutional positioning collide at the open. The resulting high and low act as key reference levels for the rest of the day.

## The Core Idea

The Opening Range Breakout strategy is built on a simple premise: **when price decisively moves beyond the opening range, it tends to continue in that direction.**

- A **breakout above** the opening range high signals bullish momentum — go long.
- A **breakdown below** the opening range low signals bearish momentum — go short.

The opening range itself provides natural levels for stop losses and profit targets, giving the strategy a built-in risk/reward framework.

## Why It Works

The ORB strategy has been used by professional day traders for decades. Its edge comes from several market dynamics:

1. **Institutional order flow** — Large funds often execute significant positions in the first 15-30 minutes. When price escapes the range created by this activity, it suggests directional conviction.

2. **Liquidity concentration** — The open is the most liquid period of the day. Breakouts from this high-liquidity zone carry more significance than breakouts during quieter hours.

3. **Overnight gap resolution** — Stocks that gap up or down at the open often establish a range while the market digests the move. A breakout from this range signals whether the gap will be "filled" (reversed) or "extended" (continued).

4. **Self-fulfilling behavior** — Many traders watch the same opening range levels. When price breaks through, the collective response (entries, stops triggering, short covering) accelerates the move.

## History

The ORB concept was popularized by **Toby Crabel** in his 1990 book *Day Trading with Short Term Price Patterns and Opening Range Breakout*. Crabel studied how narrow opening ranges often preceded large intraday moves, and developed systematic rules for trading these patterns.

**Mark Fisher** expanded on the concept with his ACD Trading Method, adding statistical "pivot range" filters to improve the signal quality. His approach, documented in *The Logical Trader* (2002), is still used by commodity and equity traders.

The strategy's simplicity and mechanical nature have made it one of the most studied and backtested day trading approaches.

## How This Implementation Works

This application implements the ORB strategy with the following structure:

### Entry Rules
- Wait for the opening range to form (configurable: 5, 15, or 30 minutes)
- **Long entry**: Price closes above the opening range high (or wicks above, depending on confirmation setting)
- **Short entry**: Price closes below the opening range low
- **Volume confirmation**: Breakout candle volume must exceed 1.5x the average volume during the opening range

### Risk Management
- **Stop loss**: Placed at the opposite side of the opening range (long stop = range low, short stop = range high), plus a small buffer
- **Position sizing**: Based on fixed-risk model — risk 2% of account per trade, with share count calculated from distance to stop
- **Max trades**: Limited to 2 trades per day to avoid overtrading

### Profit Taking
- **Partial exits** at 1.5x, 2.0x, and 3.0x the range size (closing ~33% at each level)
- **Break-even stop**: After the first target is hit, the stop moves to the entry price
- **Trailing stop**: Optional — activates after 1x range profit, trails by 0.5x range
- **End-of-day close**: All positions are closed before market close (no overnight risk)

### Pre-Market Sentiment Filter
Before trading, the system evaluates:
- **News sentiment** — Earnings, analyst upgrades/downgrades, macro events
- **Social sentiment** — Retail trader buzz and momentum
- **Options flow** — Unusual call/put activity suggesting institutional bets
- **Gap analysis** — Size and direction of the overnight gap
- **Analyst consensus** — Recent price target changes

These factors combine into a composite sentiment score that can be used to filter or weight trade signals.

## Key Metrics

When backtesting, the system tracks:

| Metric | What It Measures |
|--------|-----------------|
| Win Rate | Percentage of trades that are profitable |
| Profit Factor | Gross profits / gross losses (> 1.0 is profitable) |
| Sharpe Ratio | Risk-adjusted return (higher = better reward per unit of risk) |
| Sortino Ratio | Like Sharpe but only penalizes downside volatility |
| Max Drawdown | Largest peak-to-trough decline in account equity |
| Average Winner / Loser | Mean P&L of winning vs losing trades |
| MFE / MAE | Max Favorable / Adverse Excursion — how far trades move for and against you |

A **Monte Carlo simulation** shuffles the trade sequence thousands of times to estimate the range of possible outcomes, helping assess whether results are robust or dependent on trade order.

## Best Practices

- **Trade liquid instruments** — ORB works best on stocks and ETFs with tight spreads and high volume (SPY, QQQ, AAPL, etc.)
- **Respect the range size** — Very narrow ranges often produce larger breakouts; very wide ranges may lack a clear edge
- **Avoid major news events** — FOMC days, CPI releases, and earnings can produce false breakouts
- **Use the sentiment filter** — Aligning breakout direction with pre-market sentiment improves the probability of follow-through
- **Keep it mechanical** — The strategy's strength is its objectivity; discretionary overrides often degrade performance

## Further Reading

- Toby Crabel — *Day Trading with Short Term Price Patterns and Opening Range Breakout* (1990)
- Mark Fisher — *The Logical Trader* (2002)
- Linda Raschke & Larry Connors — *Street Smarts* (1995), Chapter on Opening Range Breakouts
