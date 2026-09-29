const DEFAULT_KEY = Buffer.from('MTg3NWJmOTJkZGRjMjk2ODBkOGJhZmY1YzM5ZWRhYTI=', 'base64').toString('ascii');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q, lat, lon, units = 'metric' } = req.query || {};
  const apiKey = process.env.OPENWEATHER_API_KEY || DEFAULT_KEY;

  let targetUrl = '';
  if (q) {
    targetUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(String(q))}&appid=${apiKey}&units=${units}`;
  } else if (lat && lon) {
    targetUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
  } else {
    return res.status(400).json({ message: 'Missing city name (q) or coordinates (lat, lon)' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Forecast API error:', error);
    return res.status(500).json({ message: 'Error fetching forecast data' });
  }
}
