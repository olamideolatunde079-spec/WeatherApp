const API_KEY = typeof window !== 'undefined' ? atob('MTg3NWJmOTJkZGRjMjk2ODBkOGJhZmY1YzM5ZWRhYTI=') : '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const PROXY_WEATHER_URL = '/api/weather';
const PROXY_FORECAST_URL = '/api/forecast';

// State management
let currentUnit = localStorage.getItem('oweather_unit') || 'metric';
let lastQuery = null; // { type: 'city', val: 'London' } or { type: 'coords', lat: 0, lon: 0 }
let lastSuccessfulData = null;
let lastSuccessfulForecast = null;
let currentAbortController = null;

// DOM Elements
const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const clearInputBtn = document.getElementById('clearInputBtn');
const locationButton = document.getElementById('locationButton');
const searchBtn = document.getElementById('searchBtn');

const celsiusBtn = document.getElementById('celsiusBtn');
const fahrenheitBtn = document.getElementById('fahrenheitBtn');
const quickCitiesContainer = document.getElementById('quickCities');

const loadingMessage = document.getElementById('loadingMessage');
const loadingText = document.getElementById('loadingText');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const dismissErrorBtn = document.getElementById('dismissErrorBtn');

const weatherCard = document.getElementById('weatherCard');
const forecastSection = document.getElementById('forecastSection');
const forecastContainer = document.getElementById('forecastContainer');

// Weather Card Elements
const cityNameText = document.getElementById('cityNameText');
const dateTimeText = document.getElementById('dateTimeText');
const conditionTag = document.getElementById('conditionTag');
const weatherFaIcon = document.getElementById('weatherFaIcon');
const weatherIcon = document.getElementById('weatherIcon');
const temperature = document.getElementById('temperature');
const unitDisplay = document.getElementById('unitDisplay');
const description = document.getElementById('description');
const tempMin = document.getElementById('tempMin');
const tempMax = document.getElementById('tempMax');

const feelsLike = document.getElementById('feelsLike');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');
const windDirectionIcon = document.getElementById('windDirectionIcon');
const pressure = document.getElementById('pressure');
const visibility = document.getElementById('visibility');
const cloudiness = document.getElementById('cloudiness');
const sunrise = document.getElementById('sunrise');
const sunset = document.getElementById('sunset');

// Sync Unit Toggle UI
function updateUnitToggleUI() {
  if (currentUnit === 'metric') {
    celsiusBtn.classList.add('active');
    fahrenheitBtn.classList.remove('active');
    unitDisplay.textContent = '°C';
  } else {
    fahrenheitBtn.classList.add('active');
    celsiusBtn.classList.remove('active');
    unitDisplay.textContent = '°F';
  }
}

// Convert wind degrees to cardinal direction
function degreesToCardinal(deg) {
  if (deg === undefined || deg === null) return '';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((deg % 360) / 22.5) % 16;
  return directions[index];
}

// Maps OpenWeather ID to Font Awesome icons & theme styles
function getWeatherIconInfo(weatherId, iconCode = '01d') {
  const isNight = iconCode.endsWith('n');

  // Group 2xx: Thunderstorm
  if (weatherId >= 200 && weatherId < 300) {
    return {
      faClass: 'fa-solid fa-cloud-bolt',
      themeClass: 'weather-thunder',
      category: 'Thunderstorm'
    };
  }

  // Group 3xx: Drizzle
  if (weatherId >= 300 && weatherId < 400) {
    return {
      faClass: 'fa-solid fa-cloud-rain',
      themeClass: 'weather-rain',
      category: 'Drizzle'
    };
  }

  // Group 5xx: Rain
  if (weatherId >= 500 && weatherId < 600) {
    if (weatherId === 511) {
      return {
        faClass: 'fa-solid fa-snowflake',
        themeClass: 'weather-snow',
        category: 'Freezing Rain'
      };
    }
    if (weatherId >= 520) {
      return {
        faClass: isNight ? 'fa-solid fa-cloud-moon-rain' : 'fa-solid fa-cloud-sun-rain',
        themeClass: 'weather-rain',
        category: 'Showers'
      };
    }
    return {
      faClass: 'fa-solid fa-cloud-showers-heavy',
      themeClass: 'weather-rain',
      category: 'Rain'
    };
  }

  // Group 6xx: Snow
  if (weatherId >= 600 && weatherId < 700) {
    return {
      faClass: 'fa-solid fa-snowflake',
      themeClass: 'weather-snow',
      category: 'Snow'
    };
  }

  // Group 7xx: Atmosphere
  if (weatherId >= 700 && weatherId < 800) {
    if (weatherId === 781) {
      return {
        faClass: 'fa-solid fa-tornado',
        themeClass: 'weather-storm',
        category: 'Tornado'
      };
    }
    if (weatherId === 771) {
      return {
        faClass: 'fa-solid fa-wind',
        themeClass: 'weather-wind',
        category: 'Squall'
      };
    }
    return {
      faClass: 'fa-solid fa-smog',
      themeClass: 'weather-fog',
      category: 'Atmosphere'
    };
  }

  // Group 800: Clear
  if (weatherId === 800) {
    return {
      faClass: isNight ? 'fa-solid fa-moon' : 'fa-solid fa-sun',
      themeClass: isNight ? 'weather-clear-night' : 'weather-clear-day',
      category: 'Clear Sky'
    };
  }

  // Group 80x: Clouds
  if (weatherId === 801 || weatherId === 802) {
    return {
      faClass: isNight ? 'fa-solid fa-cloud-moon' : 'fa-solid fa-cloud-sun',
      themeClass: isNight ? 'weather-cloudy-night' : 'weather-cloudy-day',
      category: 'Partly Cloudy'
    };
  }

  // 803, 804: Broken/overcast
  return {
    faClass: 'fa-solid fa-cloud',
    themeClass: 'weather-cloudy',
    category: 'Cloudy'
  };
}

// Compute accurate local time for destination city using timezone offset (seconds)
function formatCityDateTime(unixTimestamp, timezoneOffsetSec = 0) {
  const timestamp = unixTimestamp || Math.floor(Date.now() / 1000);
  const localMs = (timestamp + timezoneOffsetSec) * 1000;
  const date = new Date(localMs);

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayName = days[date.getUTCDay()];
  const monthName = months[date.getUTCMonth()];
  const dayNum = date.getUTCDate();

  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  return {
    fullDate: `${dayName}, ${monthName} ${dayNum}`,
    timeStr: `${hours}:${minutes} ${ampm}`
  };
}

function formatLocalTimeOnly(unixTimestamp, timezoneOffsetSec = 0) {
  if (!unixTimestamp) return '--:--';
  const localMs = (unixTimestamp + timezoneOffsetSec) * 1000;
  const date = new Date(localMs);
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Guaranteed Loading UI Controls
function setLoading(isLoading, message = 'Fetching weather data...') {
  if (isLoading) {
    loadingText.textContent = message;
    loadingMessage.hidden = false;
    loadingMessage.classList.remove('hidden');
    loadingMessage.style.display = 'flex';
  } else {
    loadingMessage.hidden = true;
    loadingMessage.classList.add('hidden');
    loadingMessage.style.display = 'none';
  }
  searchBtn.disabled = isLoading;
  locationButton.disabled = isLoading;
}

// Guaranteed Error UI Controls
function showError(message) {
  errorText.textContent = message;
  errorMessage.hidden = false;
  errorMessage.classList.remove('hidden');
  errorMessage.style.display = 'flex';

  // Only hide weather cards if there is no previously loaded valid data to view
  if (!lastSuccessfulData) {
    weatherCard.hidden = true;
    weatherCard.classList.add('hidden');
    weatherCard.style.display = 'none';
    forecastSection.hidden = true;
    forecastSection.classList.add('hidden');
    forecastSection.style.display = 'none';
  }
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.classList.add('hidden');
  errorMessage.style.display = 'none';
  errorText.textContent = '';

  // Restore weather views if previous data exists
  if (lastSuccessfulData) {
    weatherCard.hidden = false;
    weatherCard.classList.remove('hidden');
    weatherCard.style.display = 'block';
    if (lastSuccessfulForecast) {
      forecastSection.hidden = false;
      forecastSection.classList.remove('hidden');
      forecastSection.style.display = 'block';
    }
  }
}

// Robust fetch with internal timeout to prevent infinite hangs
async function fetchWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your network and try again.');
    }
    throw err;
  }
}

// Fetch helper with proxy first, direct fallback
async function fetchWithFallback(proxyUrl, fallbackUrl) {
  try {
    const response = await fetchWithTimeout(proxyUrl, {}, 6000);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("We couldn't find that city. Please verify spelling and try again.");
      }
      if (fallbackUrl) {
        try {
          const directRes = await fetchWithTimeout(fallbackUrl, {}, 6000);
          if (directRes.ok) return await directRes.json();
        } catch {
          // fall through
        }
      }
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Unable to retrieve weather data.');
    }
    return await response.json();
  } catch (err) {
    if (fallbackUrl) {
      try {
        const directRes = await fetchWithTimeout(fallbackUrl, {}, 6000);
        if (directRes.ok) return await directRes.json();
      } catch {
        // fall through
      }
    }
    throw err;
  }
}

// Core weather fetcher
async function fetchWeatherData(queryObj) {
  clearError();
  setLoading(true, 'Fetching weather data...');
  lastQuery = queryObj;

  const unitParam = currentUnit;
  let weatherProxyUrl = '';
  let weatherDirectUrl = '';
  let forecastProxyUrl = '';
  let forecastDirectUrl = '';

  if (queryObj.type === 'city') {
    const encoded = encodeURIComponent(queryObj.val);
    weatherProxyUrl = `${PROXY_WEATHER_URL}?q=${encoded}&units=${unitParam}`;
    weatherDirectUrl = `${BASE_URL}/weather?q=${encoded}&appid=${API_KEY}&units=${unitParam}`;
    forecastProxyUrl = `${PROXY_FORECAST_URL}?q=${encoded}&units=${unitParam}`;
    forecastDirectUrl = `${BASE_URL}/forecast?q=${encoded}&appid=${API_KEY}&units=${unitParam}`;
  } else if (queryObj.type === 'coords') {
    weatherProxyUrl = `${PROXY_WEATHER_URL}?lat=${queryObj.lat}&lon=${queryObj.lon}&units=${unitParam}`;
    weatherDirectUrl = `${BASE_URL}/weather?lat=${queryObj.lat}&lon=${queryObj.lon}&appid=${API_KEY}&units=${unitParam}`;
    forecastProxyUrl = `${PROXY_FORECAST_URL}?lat=${queryObj.lat}&lon=${queryObj.lon}&units=${unitParam}`;
    forecastDirectUrl = `${BASE_URL}/forecast?lat=${queryObj.lat}&lon=${queryObj.lon}&appid=${API_KEY}&units=${unitParam}`;
  }

  try {
    const [currentData, forecastData] = await Promise.all([
      fetchWithFallback(weatherProxyUrl, weatherDirectUrl),
      fetchWithFallback(forecastProxyUrl, forecastDirectUrl).catch(err => {
        console.warn('Forecast fetch warning:', err);
        return null;
      })
    ]);

    lastSuccessfulData = currentData;
    displayCurrentWeather(currentData);

    if (forecastData && forecastData.list) {
      lastSuccessfulForecast = forecastData;
      displayForecast(forecastData);
    } else {
      forecastSection.hidden = true;
      forecastSection.classList.add('hidden');
      forecastSection.style.display = 'none';
    }

    if (queryObj.type === 'city') {
      localStorage.setItem('oweather_last_city', queryObj.val);
    }
  } catch (error) {
    console.error('Weather error:', error);
    showError(error.message || 'Something went wrong while fetching weather data.');
  } finally {
    setLoading(false);
  }
}

// Display Current Weather
function displayCurrentWeather(data) {
  if (!data || !data.weather || !data.weather[0]) {
    showError('Incomplete weather information received.');
    return;
  }

  const weatherObj = data.weather[0];
  const timezoneOffset = data.timezone || 0;
  const timeInfo = formatCityDateTime(data.dt, timezoneOffset);

  // Location & Date/Time
  cityNameText.textContent = `${data.name}, ${data.sys ? data.sys.country : ''}`;
  dateTimeText.textContent = `${timeInfo.fullDate} · ${timeInfo.timeStr}`;

  // Weather Icon & Theme
  const iconInfo = getWeatherIconInfo(weatherObj.id, weatherObj.icon);
  conditionTag.textContent = iconInfo.category;

  // Font Awesome icon update
  weatherFaIcon.className = `${iconInfo.faClass} weather-fa-icon ${iconInfo.themeClass}`;
  
  // High-res OpenWeather PNG
  weatherIcon.src = `https://openweathermap.org/img/wn/${weatherObj.icon}@2x.png`;
  weatherIcon.alt = weatherObj.description;

  // Temperatures
  const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';
  temperature.textContent = Math.round(data.main.temp);
  unitDisplay.textContent = unitSymbol;
  description.textContent = weatherObj.description;

  const minVal = Math.round(data.main.temp_min);
  const maxVal = Math.round(data.main.temp_max);
  tempMin.textContent = `L: ${minVal}${unitSymbol}`;
  tempMax.textContent = `H: ${maxVal}${unitSymbol}`;

  // Details
  feelsLike.textContent = `${Math.round(data.main.feels_like)}${unitSymbol}`;
  humidity.textContent = `${data.main.humidity}%`;

  // Wind speed & compass rotation
  const speedUnit = currentUnit === 'metric' ? 'm/s' : 'mph';
  const windSpeedRounded = Math.round(data.wind.speed * 10) / 10;
  const cardinal = degreesToCardinal(data.wind.deg);
  wind.textContent = `${windSpeedRounded} ${speedUnit} ${cardinal}`;

  if (data.wind.deg !== undefined) {
    const rotationDeg = data.wind.deg - 45;
    windDirectionIcon.style.transform = `rotate(${rotationDeg}deg)`;
    windDirectionIcon.style.display = 'inline-block';
    windDirectionIcon.title = `Wind direction: ${data.wind.deg}° (${cardinal})`;
  } else {
    windDirectionIcon.style.display = 'none';
  }

  // Pressure
  pressure.textContent = `${data.main.pressure} hPa`;

  // Visibility
  if (data.visibility !== undefined) {
    if (currentUnit === 'metric') {
      const visKm = (data.visibility / 1000).toFixed(1);
      visibility.textContent = `${visKm} km`;
    } else {
      const visMi = (data.visibility / 1609.34).toFixed(1);
      visibility.textContent = `${visMi} mi`;
    }
  } else {
    visibility.textContent = 'N/A';
  }

  // Cloudiness
  cloudiness.textContent = data.clouds ? `${data.clouds.all}%` : '0%';

  // Sunrise & Sunset
  if (data.sys) {
    sunrise.textContent = formatLocalTimeOnly(data.sys.sunrise, timezoneOffset);
    sunset.textContent = formatLocalTimeOnly(data.sys.sunset, timezoneOffset);
  } else {
    sunrise.textContent = '--:--';
    sunset.textContent = '--:--';
  }

  // Show weather card
  weatherCard.hidden = false;
  weatherCard.classList.remove('hidden');
  weatherCard.style.display = 'block';
}

// Display 5-Day Forecast
function displayForecast(forecastData) {
  forecastContainer.innerHTML = '';
  const list = forecastData.list || [];
  if (list.length === 0) {
    forecastSection.hidden = true;
    forecastSection.classList.add('hidden');
    forecastSection.style.display = 'none';
    return;
  }

  const timezoneOffset = (forecastData.city && forecastData.city.timezone) ? forecastData.city.timezone : 0;
  const unitSymbol = currentUnit === 'metric' ? '°C' : '°F';

  // Group items by calendar day (YYYY-MM-DD)
  const daysMap = new Map();

  list.forEach(item => {
    const localMs = (item.dt + timezoneOffset) * 1000;
    const date = new Date(localMs);
    const dayKey = date.toISOString().split('T')[0];

    if (!daysMap.has(dayKey)) {
      daysMap.set(dayKey, []);
    }
    daysMap.get(dayKey).push(item);
  });

  const dayKeys = Array.from(daysMap.keys()).slice(0, 5);

  dayKeys.forEach((key, index) => {
    const items = daysMap.get(key);
    let representative = items[0];
    let minDiffFromNoon = Infinity;

    let minTemp = Infinity;
    let maxTemp = -Infinity;
    let maxPop = 0;

    items.forEach(it => {
      if (it.main.temp_min < minTemp) minTemp = it.main.temp_min;
      if (it.main.temp_max > maxTemp) maxTemp = it.main.temp_max;
      if (it.pop && it.pop > maxPop) maxPop = it.pop;

      const d = new Date((it.dt + timezoneOffset) * 1000);
      const hour = d.getUTCHours();
      const diff = Math.abs(hour - 12);
      if (diff < minDiffFromNoon) {
        minDiffFromNoon = diff;
        representative = it;
      }
    });

    const repDate = new Date((representative.dt + timezoneOffset) * 1000);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let dayTitle = dayNames[repDate.getUTCDay()];
    if (index === 0) dayTitle = 'Today';
    const dateSubtitle = `${monthNames[repDate.getUTCMonth()]} ${repDate.getUTCDate()}`;

    const weather = representative.weather[0] || {};
    const iconInfo = getWeatherIconInfo(weather.id, weather.icon);

    const rainPct = Math.round(maxPop * 100);

    const card = document.createElement('div');
    card.className = 'forecast-card';
    card.innerHTML = `
      <div class="forecast-day">${dayTitle}</div>
      <div class="forecast-date">${dateSubtitle}</div>
      <div class="forecast-icon">
        <i class="${iconInfo.faClass} ${iconInfo.themeClass}" aria-hidden="true"></i>
      </div>
      <div class="forecast-desc">${weather.main || weather.description}</div>
      <div class="forecast-temp">
        <span class="max">${Math.round(maxTemp)}${unitSymbol}</span>
        <span class="min">${Math.round(minTemp)}${unitSymbol}</span>
      </div>
      ${rainPct > 15 ? `<div class="forecast-rain"><i class="fa-solid fa-umbrella" aria-hidden="true"></i> ${rainPct}%</div>` : '<div class="forecast-rain-empty"></div>'}
    `;
    forecastContainer.appendChild(card);
  });

  forecastSection.hidden = false;
  forecastSection.classList.remove('hidden');
  forecastSection.style.display = 'block';
}

// Event Listeners
searchForm.addEventListener('submit', function (event) {
  event.preventDefault();
  const city = cityInput.value.trim();

  if (!city) {
    showError('Please enter a city name to search.');
    return;
  }

  fetchWeatherData({ type: 'city', val: city });
});

// Clear Input Button UX
cityInput.addEventListener('input', function () {
  const hasValue = cityInput.value.trim().length > 0;
  clearInputBtn.hidden = !hasValue;
  if (hasValue) {
    clearInputBtn.classList.remove('hidden');
    clearInputBtn.style.display = 'flex';
  } else {
    clearInputBtn.classList.add('hidden');
    clearInputBtn.style.display = 'none';
  }
});

clearInputBtn.addEventListener('click', function (e) {
  e.preventDefault();
  cityInput.value = '';
  clearInputBtn.hidden = true;
  clearInputBtn.classList.add('hidden');
  clearInputBtn.style.display = 'none';
  cityInput.focus();
});

// Geolocation button with safety timeout
locationButton.addEventListener('click', function () {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  clearError();
  setLoading(true, 'Detecting your coordinates...');
  locationButton.classList.add('loading');

  let geoResolved = false;
  const safetyTimeout = setTimeout(() => {
    if (!geoResolved) {
      geoResolved = true;
      locationButton.classList.remove('loading');
      setLoading(false);
      showError('Location request timed out. Please search by city name.');
    }
  }, 7000);

  navigator.geolocation.getCurrentPosition(
    function (position) {
      if (geoResolved) return;
      geoResolved = true;
      clearTimeout(safetyTimeout);
      locationButton.classList.remove('loading');
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      fetchWeatherData({ type: 'coords', lat, lon });
    },
    function (geoError) {
      if (geoResolved) return;
      geoResolved = true;
      clearTimeout(safetyTimeout);
      locationButton.classList.remove('loading');
      setLoading(false);
      let message = 'Unable to retrieve location. Please check browser permissions or search by city name.';
      if (geoError.code === 1) {
        message = 'Location access was denied. Please allow location permissions in your browser or search by city name.';
      } else if (geoError.code === 2) {
        message = 'Location information is currently unavailable.';
      } else if (geoError.code === 3) {
        message = 'Location request timed out. Please try again or search by city.';
      }
      showError(message);
    },
    { timeout: 6000, enableHighAccuracy: true }
  );
});

// Unit Toggles (°C / °F)
celsiusBtn.addEventListener('click', function () {
  if (currentUnit === 'metric') return;
  currentUnit = 'metric';
  localStorage.setItem('oweather_unit', 'metric');
  updateUnitToggleUI();
  if (lastQuery) {
    fetchWeatherData(lastQuery);
  }
});

fahrenheitBtn.addEventListener('click', function () {
  if (currentUnit === 'imperial') return;
  currentUnit = 'imperial';
  localStorage.setItem('oweather_unit', 'imperial');
  updateUnitToggleUI();
  if (lastQuery) {
    fetchWeatherData(lastQuery);
  }
});

// Quick city buttons
quickCitiesContainer.addEventListener('click', function (event) {
  const btn = event.target.closest('.quick-city-btn');
  if (!btn) return;
  const cityName = btn.dataset.city;
  if (cityName) {
    cityInput.value = cityName;
    clearInputBtn.hidden = false;
    clearInputBtn.classList.remove('hidden');
    clearInputBtn.style.display = 'flex';
    fetchWeatherData({ type: 'city', val: cityName });
  }
});

// Error dismiss button with event stop and clean dismiss
dismissErrorBtn.addEventListener('click', function (e) {
  e.preventDefault();
  e.stopPropagation();
  clearError();
});

// Initialize on page load
updateUnitToggleUI();
const defaultCity = localStorage.getItem('oweather_last_city') || 'London';
fetchWeatherData({ type: 'city', val: defaultCity });
