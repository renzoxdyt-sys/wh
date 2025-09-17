// api/quotes.js
import fetch from 'node-fetch';

const SYMBOLS = [
  // índices globales (Finnhub acepta algunos caret symbols)
  "^GSPC","^DJI","^IXIC","^FTSE","^GDAXI","^N225","^FCHI","^HSI",
  // criptos (símbolos estilo broker / exchange que Finnhub soporta)
  "BINANCE:BTCUSDT","BINANCE:ETHUSDT","BINANCE:ADAUSDT","BINANCE:XRPUSDT",
  // algunos ETFs / productos
  "IAU","ARGT"
];

export default async function handler(req, res) {
  const key = process.env.FINNHUB_KEY;
  if (!key) {
    return res.status(500).json({ error: 'FINNHUB_KEY not configured' });
  }

  try {
    const promises = SYMBOLS.map(async (sym) => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`;
      const r = await fetch(url);
      if (!r.ok) {
        return { symbol: sym, label: sym, price: null, changePct: null, error: true };
      }
      const j = await r.json();
      const price = (j && typeof j.c === 'number' && j.c > 0) ? j.c : null;
      const changePct = (j && typeof j.dp === 'number') ? Number(j.dp.toFixed(2)) : null;
      return { symbol: sym, label: sym, price, changePct, error: false };
    });

    const results = await Promise.all(promises);
    // Edge cache short to reduce calls
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json({ ts: Date.now(), results });
  } catch (err) {
    console.error('quotes error', err);
    return res.status(500).json({ error: 'failed to fetch quotes', details: err.message });
  }
}

