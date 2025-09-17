// api/quotes.js
// Vercel Serverless (Node 18+). No API key required (uses Yahoo Finance public endpoint)
const SYMBOLS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^DJI', label: 'Dow Jones' },
  { symbol: '^IXIC', label: 'Nasdaq' },
  { symbol: '^FTSE', label: 'FTSE 100' },
  { symbol: '^GDAXI', label: 'DAX' },
  { symbol: '^N225', label: 'Nikkei 225' },
  { symbol: '^FCHI', label: 'CAC 40' },
  { symbol: '^HSI', label: 'Hang Seng' },

  // Commodities (futures tickers on Yahoo)
  { symbol: 'GC=F', label: 'Gold (futures)' },
  { symbol: 'SI=F', label: 'Silver (futures)' },
  { symbol: 'HG=F', label: 'Copper (futures)' },
  { symbol: 'CL=F', label: 'Crude Oil (futures)' }
];

export default async function handler(req, res) {
  try {
    // Build comma-separated list for Yahoo
    const symbols = SYMBOLS.map(s => s.symbol).join(',');
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;

    const r = await globalThis.fetch(url, { method: 'GET' });
    if (!r.ok) {
      const txt = await r.text().catch(()=>null);
      console.error('yahoo fetch error', r.status, txt);
      return res.status(502).json({ error: 'failed to fetch from Yahoo', status: r.status });
    }
    const j = await r.json();
    const resultsRaw = (j && j.quoteResponse && Array.isArray(j.quoteResponse.result)) ? j.quoteResponse.result : [];

    // Normalize: map each requested symbol to an object { symbol, label, price, changePct }
    const mapBySymbol = {};
    resultsRaw.forEach(item => {
      // Yahoo fields: regularMarketPrice, regularMarketChangePercent
      const sym = (item.symbol || '').toString().toUpperCase();
      const price = (typeof item.regularMarketPrice === 'number') ? item.regularMarketPrice : null;
      // regularMarketChangePercent may exist
      const changePct = (typeof item.regularMarketChangePercent === 'number') ? Number(item.regularMarketChangePercent.toFixed(2)) : null;
      mapBySymbol[sym] = { symbol: sym, price, changePct, raw: item };
    });

    // Build ordered results from SYMBOLS list
    const results = SYMBOLS.map(s => {
      const key = (s.symbol || '').toString().toUpperCase();
      const found = mapBySymbol[key];
      if (found) {
        return { symbol: s.symbol, label: s.label, price: found.price, changePct: found.changePct };
      } else {
        // Missing data -> return nulls
        return { symbol: s.symbol, label: s.label, price: null, changePct: null };
      }
    });

    // Short edge cache (30s) — reduces repeated calls
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ ts: Date.now(), results });
  } catch (err) {
    console.error('quotes handler error', err);
    return res.status(500).json({ error: 'internal', details: err.message });
  }
}
