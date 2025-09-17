// api/quotes.js
// Vercel Serverless function (Node.js)
import fetch from 'node-fetch';

const SYMBOLS = [
  // indices (Finnhub supports caret-prefixed for some indices)
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^IXIC', label: 'Nasdaq' },
  { symbol: '^FTSE', label: 'FTSE 100' },
  { symbol: '^N225', label: 'Nikkei 225' },

  // crypto (using Binance pairs supported by Finnhub)
  { symbol: 'BINANCE:BTCUSDT', label: 'BTC' },
  { symbol: 'BINANCE:ETHUSDT', label: 'ETH' },
  { symbol: 'BINANCE:ADAUSDT', label: 'ADA' },
  { symbol: 'BINANCE:XRPUSDT', label: 'XRP' }
];

export default async function handler(req, res) {
  const key = process.env.FINNHUB_KEY;
  if (!key) {
    return res.status(500).json({ error: 'FINNHUB_KEY not set in environment' });
  }

  try {
    // Perform all requests in parallel
    const promises = SYMBOLS.map(async (s) => {
      // Finnhub quote endpoint
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(s.symbol)}&token=${encodeURIComponent(key)}`;
      const r = await fetch(url, { method: 'GET' });
      if (!r.ok) {
        return { symbol: s.symbol, label: s.label, price: null, changePct: null, error: true };
      }
      const j = await r.json();
      // Finnhub returns: c (current price), d (change), dp (change percent)
      const price = (j && typeof j.c === 'number' && j.c !== 0) ? j.c : null;
      const changePct = (j && typeof j.dp === 'number') ? Number(j.dp.toFixed(2)) : null;
      return { symbol: s.symbol, label: s.label, price, changePct, error: false };
    });

    const results = await Promise.all(promises);
    // Return array in same order
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10'); // small caching on Vercel
    return res.status(200).json({ ts: Date.now(), results });
  } catch (err) {
    console.error('quotes error', err);
    return res.status(500).json({ error: 'failed to fetch quotes' });
  }
}
