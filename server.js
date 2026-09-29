import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import weatherHandler from './api/weather.js';
import forecastHandler from './api/forecast.js';

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

app.get('/api/weather', weatherHandler);
app.get('/api/forecast', forecastHandler);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Weather app listening on http://${HOST}:${PORT}`);
});
