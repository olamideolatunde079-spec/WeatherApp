import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Enable CORS & no-cache headers for API endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.static(__dirname));

const DEFAULT_KEY = Buffer.from('MTg3NWJmOTJkZGRjMjk2ODBkOGJhZmY1YzM5ZWRhYTI=', 'base64').toString('ascii');

app.get('/api/weather', async (req, res) => {
  const { q, lat, lon, units = 'metric' } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY || DEFAULT_KEY;

  let targetUrl = '';
  if (q) {
    targetUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(String(q))}&appid=${apiKey}&units=${units}`;
  } else if (lat && lon) {
    targetUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
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
    console.error('Weather proxy error:', error);
    return res.status(500).json({ message: 'Error fetching weather data' });
  }
});

app.get('/api/forecast', async (req, res) => {
  const { q, lat, lon, units = 'metric' } = req.query;
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
    console.error('Forecast proxy error:', error);
    return res.status(500).json({ message: 'Error fetching forecast data' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Weather app listening on http://${HOST}:${PORT}`);
});
