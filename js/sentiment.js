/**
 * Sentiment Analysis Engine
 *
 * Simulates pre-market sentiment analysis for stocks:
 * - News sentiment scoring (positive/negative/neutral)
 * - Social media buzz analysis
 * - Pre-market volume analysis
 * - Gap analysis (overnight price change)
 * - Analyst ratings aggregation
 * - Options flow sentiment
 * - Overall composite sentiment score
 *
 * Uses deterministic generation based on ticker + date for consistency
 */

const SentimentAnalysis = (() => {

  // Simulated news headlines by sentiment type
  const NEWS_TEMPLATES = {
    positive: [
      '{ticker} beats Q4 earnings estimates by 12%, revenue up 15% YoY',
      'Analysts upgrade {ticker} to "Strong Buy" citing growth momentum',
      '{ticker} announces $5B share buyback program',
      '{ticker} secures major government contract worth $2.3B',
      'Breaking: {ticker} CEO announces strategic acquisition',
      '{ticker} reports record-breaking quarterly revenue',
      'Institutional investors increase {ticker} holdings by 8%',
      '{ticker} expands into new market, shares surge pre-market',
      'FDA approves {ticker}\'s new product application',
      '{ticker} raises full-year guidance above consensus',
    ],
    negative: [
      '{ticker} misses earnings expectations, guidance lowered',
      'SEC investigation into {ticker} accounting practices',
      '{ticker} announces workforce reduction of 10%',
      'Major {ticker} customer switches to competitor',
      '{ticker} CFO departure raises governance concerns',
      'Supply chain disruptions impact {ticker} Q4 outlook',
      'Analysts downgrade {ticker} citing valuation concerns',
      '{ticker} faces class-action lawsuit from shareholders',
      '{ticker} product recall affects consumer confidence',
      '{ticker} warns of revenue shortfall in coming quarter',
    ],
    neutral: [
      '{ticker} trading in line with sector peers ahead of earnings',
      '{ticker} maintains market position amid competitive landscape',
      'Analysts maintain "Hold" rating on {ticker}',
      '{ticker} announces routine board of directors changes',
      '{ticker} participates in industry conference this week',
      '{ticker} files standard regulatory paperwork',
      'Options activity in {ticker} remains within normal range',
      '{ticker} index rebalancing expected with minimal impact',
    ],
  };

  // Social media buzz keywords
  const SOCIAL_BUZZ = {
    bullish: ['moon', 'breakout', 'buy the dip', 'undervalued', 'accumulate', 'bullish divergence', 'golden cross'],
    bearish: ['overvalued', 'crash', 'bubble', 'sell', 'short', 'bearish', 'dead cat bounce', 'head and shoulders'],
    neutral: ['watching', 'interesting', 'on my radar', 'need more data', 'sideways', 'consolidation'],
  };

  function seededRandom(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (s >>> 0) / 0xFFFFFFFF;
    };
  }

  // Generate sentiment analysis for a specific ticker on a specific date
  function analyze(ticker, date, prevClose) {
    const dateStr = date instanceof Date ? date.toISOString().slice(0, 10) : date;
    const seed = hashCode(ticker + dateStr);
    const rng = seededRandom(seed);

    // News sentiment
    const newsSentiment = generateNewsSentiment(ticker, rng);

    // Social media sentiment
    const socialSentiment = generateSocialSentiment(ticker, rng);

    // Pre-market volume analysis
    const volumeAnalysis = generateVolumeAnalysis(ticker, rng);

    // Gap analysis
    const gapAnalysis = generateGapAnalysis(ticker, rng, prevClose);

    // Analyst ratings
    const analystRatings = generateAnalystRatings(ticker, rng);

    // Options flow
    const optionsFlow = generateOptionsFlow(ticker, rng);

    // Compute composite score (-100 to +100)
    const compositeScore = computeCompositeScore({
      newsSentiment,
      socialSentiment,
      volumeAnalysis,
      gapAnalysis,
      analystRatings,
      optionsFlow,
    });

    return {
      ticker,
      date: dateStr,
      timestamp: new Date().toISOString(),
      compositeScore,
      confidence: parseFloat((0.5 + rng() * 0.4).toFixed(2)),
      recommendation: getRecommendation(compositeScore),
      news: newsSentiment,
      social: socialSentiment,
      volume: volumeAnalysis,
      gap: gapAnalysis,
      analysts: analystRatings,
      options: optionsFlow,
    };
  }

  function generateNewsSentiment(ticker, rng) {
    const numArticles = 3 + Math.floor(rng() * 5);
    const articles = [];
    let totalScore = 0;

    for (let i = 0; i < numArticles; i++) {
      const roll = rng();
      let sentiment, templates, score;
      if (roll < 0.35) {
        sentiment = 'positive';
        templates = NEWS_TEMPLATES.positive;
        score = 0.3 + rng() * 0.7;
      } else if (roll < 0.65) {
        sentiment = 'neutral';
        templates = NEWS_TEMPLATES.neutral;
        score = -0.1 + rng() * 0.2;
      } else {
        sentiment = 'negative';
        templates = NEWS_TEMPLATES.negative;
        score = -(0.3 + rng() * 0.7);
      }

      const template = templates[Math.floor(rng() * templates.length)];
      const hoursAgo = Math.floor(rng() * 12) + 1;

      articles.push({
        headline: template.replace('{ticker}', ticker),
        sentiment,
        score: parseFloat(score.toFixed(2)),
        source: ['Reuters', 'Bloomberg', 'CNBC', 'WSJ', 'MarketWatch', 'Barron\'s'][Math.floor(rng() * 6)],
        timeAgo: `${hoursAgo}h ago`,
      });
      totalScore += score;
    }

    const avgScore = numArticles > 0 ? totalScore / numArticles : 0;

    return {
      articles,
      overallScore: parseFloat((avgScore * 100).toFixed(1)),
      sentiment: avgScore > 0.15 ? 'Bullish' : avgScore < -0.15 ? 'Bearish' : 'Neutral',
      articleCount: numArticles,
    };
  }

  function generateSocialSentiment(ticker, rng) {
    const mentions = Math.floor(500 + rng() * 5000);
    const bullishPct = 20 + rng() * 60;
    const bearishPct = rng() * (100 - bullishPct - 10);
    const neutralPct = 100 - bullishPct - bearishPct;

    const trendingKeywords = [];
    const keywordPool = rng() > 0.5 ? SOCIAL_BUZZ.bullish : SOCIAL_BUZZ.bearish;
    for (let i = 0; i < 3; i++) {
      trendingKeywords.push(keywordPool[Math.floor(rng() * keywordPool.length)]);
    }

    const score = (bullishPct - bearishPct);

    return {
      mentions,
      bullishPercent: parseFloat(bullishPct.toFixed(1)),
      bearishPercent: parseFloat(bearishPct.toFixed(1)),
      neutralPercent: parseFloat(neutralPct.toFixed(1)),
      trendingKeywords: [...new Set(trendingKeywords)],
      score: parseFloat(score.toFixed(1)),
      sentiment: score > 15 ? 'Bullish' : score < -15 ? 'Bearish' : 'Neutral',
      momentum: rng() > 0.5 ? 'Increasing' : 'Decreasing',
      platformBreakdown: {
        twitter: Math.floor(mentions * (0.4 + rng() * 0.2)),
        reddit: Math.floor(mentions * (0.2 + rng() * 0.15)),
        stocktwits: Math.floor(mentions * (0.15 + rng() * 0.1)),
        other: 0,
      },
    };
  }

  function generateVolumeAnalysis(ticker, rng) {
    const profile = MarketData.STOCK_PROFILES[ticker];
    const avgVolume = profile ? profile.avgVolume : 10000000;
    const preMarketVolume = Math.floor(avgVolume * (0.01 + rng() * 0.05));
    const volumeRatio = parseFloat((preMarketVolume / (avgVolume * 0.02)).toFixed(2));

    return {
      preMarketVolume,
      avgPreMarketVolume: Math.floor(avgVolume * 0.02),
      volumeRatio,
      isAboveAverage: volumeRatio > 1.2,
      signal: volumeRatio > 2 ? 'Very High' : volumeRatio > 1.2 ? 'Above Average' :
              volumeRatio < 0.5 ? 'Low' : 'Normal',
      implication: volumeRatio > 1.5
        ? 'High pre-market volume suggests significant interest and potential volatility'
        : 'Normal pre-market activity, expect standard opening conditions',
    };
  }

  function generateGapAnalysis(ticker, rng, prevClose) {
    const profile = MarketData.STOCK_PROFILES[ticker];
    const price = prevClose || (profile ? profile.basePrice : 100);
    const gapPercent = (rng() - 0.5) * profile.volatility * 200;
    const gapDollar = price * gapPercent / 100;
    const preMarketPrice = price + gapDollar;

    let gapType;
    const absGap = Math.abs(gapPercent);
    if (absGap < 0.3) gapType = 'Flat Open';
    else if (absGap < 1.0) gapType = gapPercent > 0 ? 'Small Gap Up' : 'Small Gap Down';
    else if (absGap < 2.5) gapType = gapPercent > 0 ? 'Gap Up' : 'Gap Down';
    else gapType = gapPercent > 0 ? 'Large Gap Up' : 'Large Gap Down';

    // Gap fill probability (historical tendency)
    const fillProb = absGap < 1 ? 0.65 + rng() * 0.15 : absGap < 2 ? 0.45 + rng() * 0.2 : 0.25 + rng() * 0.2;

    return {
      previousClose: parseFloat(price.toFixed(2)),
      preMarketPrice: parseFloat(preMarketPrice.toFixed(2)),
      gapPercent: parseFloat(gapPercent.toFixed(2)),
      gapDollar: parseFloat(gapDollar.toFixed(2)),
      gapType,
      direction: gapPercent > 0 ? 'Up' : gapPercent < 0 ? 'Down' : 'Flat',
      gapFillProbability: parseFloat((fillProb * 100).toFixed(0)),
      score: parseFloat((gapPercent * 10).toFixed(1)),
    };
  }

  function generateAnalystRatings(ticker, rng) {
    const totalAnalysts = 15 + Math.floor(rng() * 20);
    const strongBuy = Math.floor(totalAnalysts * (0.1 + rng() * 0.3));
    const buy = Math.floor(totalAnalysts * (0.1 + rng() * 0.2));
    const hold = Math.floor(totalAnalysts * (0.1 + rng() * 0.3));
    const remaining = totalAnalysts - strongBuy - buy - hold;
    const sell = Math.floor(remaining * (0.3 + rng() * 0.4));
    const strongSell = remaining - sell;

    const weightedScore = (strongBuy * 5 + buy * 4 + hold * 3 + sell * 2 + strongSell * 1) / totalAnalysts;

    const profile = MarketData.STOCK_PROFILES[ticker];
    const currentPrice = profile ? profile.basePrice : 100;
    const priceTarget = currentPrice * (0.9 + rng() * 0.3);

    return {
      totalAnalysts,
      strongBuy,
      buy,
      hold,
      sell,
      strongSell,
      consensusRating: weightedScore > 4 ? 'Strong Buy' : weightedScore > 3.5 ? 'Buy' :
                       weightedScore > 2.5 ? 'Hold' : weightedScore > 1.5 ? 'Sell' : 'Strong Sell',
      weightedScore: parseFloat(weightedScore.toFixed(2)),
      avgPriceTarget: parseFloat(priceTarget.toFixed(2)),
      upside: parseFloat(((priceTarget - currentPrice) / currentPrice * 100).toFixed(1)),
      score: parseFloat(((weightedScore - 3) * 33).toFixed(1)), // Normalize to -100 to +100 range
    };
  }

  function generateOptionsFlow(ticker, rng) {
    const totalContracts = Math.floor(5000 + rng() * 50000);
    const callRatio = 0.3 + rng() * 0.4;
    const callVolume = Math.floor(totalContracts * callRatio);
    const putVolume = totalContracts - callVolume;
    const putCallRatio = parseFloat((putVolume / callVolume).toFixed(2));

    // Unusual activity detection
    const unusualActivity = rng() > 0.7;
    const largeBlocks = Math.floor(rng() * 5);

    return {
      totalContracts,
      callVolume,
      putVolume,
      putCallRatio,
      sentiment: putCallRatio < 0.7 ? 'Bullish' : putCallRatio > 1.3 ? 'Bearish' : 'Neutral',
      unusualActivity,
      largeBlockTrades: largeBlocks,
      impliedMove: parseFloat((1 + rng() * 4).toFixed(1)),
      score: parseFloat(((1 - putCallRatio) * 50).toFixed(1)),
      summary: putCallRatio < 0.7
        ? 'Heavy call buying suggests bullish positioning'
        : putCallRatio > 1.3
          ? 'Elevated put activity indicates hedging or bearish bets'
          : 'Balanced options flow, no strong directional bias',
    };
  }

  function computeCompositeScore(components) {
    const weights = {
      news: 0.25,
      social: 0.15,
      volume: 0.10,
      gap: 0.20,
      analysts: 0.15,
      options: 0.15,
    };

    const score =
      components.newsSentiment.overallScore * weights.news +
      components.socialSentiment.score * weights.social +
      (components.volumeAnalysis.volumeRatio > 1.5 ? 10 : -5) * weights.volume +
      components.gapAnalysis.score * weights.gap +
      components.analystRatings.score * weights.analysts +
      components.optionsFlow.score * weights.options;

    return parseFloat(Math.max(-100, Math.min(100, score)).toFixed(1));
  }

  function getRecommendation(score) {
    if (score > 40) return { action: 'Strong Long Bias', color: '#00C853', icon: '++' };
    if (score > 15) return { action: 'Slight Long Bias', color: '#4CAF50', icon: '+' };
    if (score > -15) return { action: 'Neutral - Follow Strategy', color: '#FF9800', icon: '~' };
    if (score > -40) return { action: 'Slight Short Bias', color: '#FF5722', icon: '-' };
    return { action: 'Strong Short Bias', color: '#F44336', icon: '--' };
  }

  // Analyze multiple tickers and rank them
  function analyzeWatchlist(tickers, date) {
    const results = tickers.map(ticker => {
      const profile = MarketData.STOCK_PROFILES[ticker];
      return analyze(ticker, date, profile ? profile.basePrice : 100);
    });

    results.sort((a, b) => Math.abs(b.compositeScore) - Math.abs(a.compositeScore));
    return results;
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  return {
    analyze,
    analyzeWatchlist,
    NEWS_TEMPLATES,
  };
})();

if (typeof module !== 'undefined') module.exports = SentimentAnalysis;
