interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

interface TechnicalIndicators {
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  atr14: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  avgVolume10d: number | null;
  changePct5d: number | null;
}

function calculateSma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

function calculateRsi(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calculateEma(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const emaValues: number[] = [];

  let sma = 0;
  for (let i = 0; i < period; i++) {
    sma += values[i];
  }
  sma /= period;
  emaValues.push(sma);

  for (let i = period; i < values.length; i++) {
    const ema = (values[i] - emaValues[emaValues.length - 1]) * multiplier + emaValues[emaValues.length - 1];
    emaValues.push(ema);
  }

  return emaValues;
}

interface MacdResult {
  line: number | null;
  signal: number | null;
  histogram: number | null;
}

function calculateMacd(
  closes: number[],
  shortPeriod: number = 12,
  longPeriod: number = 26,
  signalPeriod: number = 9
): MacdResult {
  if (closes.length < longPeriod + signalPeriod) {
    return { line: null, signal: null, histogram: null };
  }

  const emaShort = calculateEma(closes, shortPeriod);
  const emaLong = calculateEma(closes, longPeriod);

  const macdLine: number[] = [];

  for (let i = 0; i < emaLong.length; i++) {
    const shortIndex = i + (longPeriod - shortPeriod);
    if (shortIndex >= 0 && shortIndex < emaShort.length) {
      macdLine.push(emaShort[shortIndex] - emaLong[i]);
    }
  }

  if (macdLine.length < signalPeriod) {
    return { line: null, signal: null, histogram: null };
  }

  const signalLine = calculateEma(macdLine, signalPeriod);
  const latestMacd = macdLine[macdLine.length - 1];
  const latestSignal = signalLine[signalLine.length - 1];

  return {
    line: latestMacd,
    signal: latestSignal,
    histogram: latestMacd - latestSignal,
  };
}

function calculateAtr(candles: Candle[], period: number = 14): number | null {
  if (candles.length < period + 1) return null;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].h;
    const low = candles[i].l;
    const prevClose = candles[i - 1].c;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  const recentTr = trueRanges.slice(-period);
  const sum = recentTr.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

function calculate52WeekHighLow(candles: Candle[]): { high: number | null; low: number | null } {
  const recent = candles.slice(-252);
  if (recent.length === 0) return { high: null, low: null };

  let high = -Infinity;
  let low = Infinity;

  for (const candle of recent) {
    if (candle.h > high) high = candle.h;
    if (candle.l < low) low = candle.l;
  }

  return { high, low };
}

function calculateAvgVolume(candles: Candle[], days: number = 10): number | null {
  const recent = candles.slice(-days);
  if (recent.length === 0) return null;

  const sum = recent.reduce((acc, c) => acc + c.v, 0);
  return sum / recent.length;
}

function calculateChangePct5d(candles: Candle[]): number | null {
  if (candles.length < 6) return null;
  const current = candles[candles.length - 1].c;
  const fiveDaysAgo = candles[candles.length - 6].c;
  if (fiveDaysAgo === 0) return null;
  return ((current - fiveDaysAgo) / fiveDaysAgo) * 100;
}

function calculateAllIndicators(candles: Candle[]): TechnicalIndicators {
  const closes = candles.map((c) => c.c);

  const macd = calculateMacd(closes);
  const highLow = calculate52WeekHighLow(candles);

  return {
    rsi14: calculateRsi(closes, 14),
    macdLine: macd.line,
    macdSignal: macd.signal,
    macdHistogram: macd.histogram,
    sma20: calculateSma(closes, 20),
    sma50: calculateSma(closes, 50),
    sma200: calculateSma(closes, 200),
    atr14: calculateAtr(candles, 14),
    weekHigh52: highLow.high,
    weekLow52: highLow.low,
    avgVolume10d: calculateAvgVolume(candles, 10),
    changePct5d: calculateChangePct5d(candles),
  };
}

export { calculateAllIndicators };
export type { TechnicalIndicators, Candle };
