const API_KEY = '1875bf92dddc29680d8baff5c39edaa2';

const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const locationButton = document.getElementById('locationButton');

const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const weatherCard = document.getElementById('weatherCard');

const cityName = document.getElementById('cityName');
const dateText = document.getElementById('dateText');
const weatherIcon = document.getElementById('weatherIcon');
const temperature = document.getElementById('temperature');
const description = document.getElementById('description');
const feelsLike = document.getElementById('feelsLike');
const humidity = document.getElementById('humidity');
const wind = document.getElementById('wind');


function setLoading(isLoading) {
  loadingMessage.hidden = !isLoading;
}

// Shows an error message and hides the weather card
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  weatherCard.hidden = true;
}

// Hides the error message
function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function getFormattedDate() {
  const today = new Date();
  return today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

async function getWeatherByCity(city) {
  const url = `${BASE_URL}?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`;
  await fetchAndDisplayWeather(url);
}

async function getWeatherByCoordinates(lat, lon) {
  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
  await fetchAndDisplayWeather(url);
}

async function fetchAndDisplayWeather(url) {
  clearError();
  setLoading(true);
  weatherCard.hidden = true;

  try {
   
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("We couldn't find that city. Check the spelling and try again.");
      }
      if (response.status === 401) {
        throw new Error('Invalid API key. Double check the API_KEY at the top of script.js.');
      }
      throw new Error('Something went wrong fetching the weather. Please try again.');
    }

    const data = await response.json();

    displayWeather(data);
  } catch (error) {

    showError(error.message);
  } finally {

    setLoading(false);
  }
}

function displayWeather(data) {
  // The API gives us a lot of information; we only pull out
  // the pieces we actually want to show.

  cityName.textContent = `${data.name}, ${data.sys.country}`;
  dateText.textContent = getFormattedDate();

  const iconCode = data.weather[0].icon;
  weatherIcon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  weatherIcon.alt = data.weather[0].description;

  temperature.textContent = `${Math.round(data.main.temp)}°C`;
  description.textContent = data.weather[0].description;

  feelsLike.textContent = `${Math.round(data.main.feels_like)}°C`;
  humidity.textContent = `${data.main.humidity}%`;
  wind.textContent = `${Math.round(data.wind.speed)} m/s`;

  weatherCard.hidden = false;
}

searchForm.addEventListener('submit', function (event) {
  // Stop the page from refreshing (the form's default behavior)
  event.preventDefault();

  const city = cityInput.value.trim();

  if (city === '') {
    showError('Please type a city name first.');
    return;
  }

  getWeatherByCity(city);
  cityInput.value = '';
});

// Searching by the user's current location
locationButton.addEventListener('click', function () {
  if (!navigator.geolocation) {
    showError('Geolocation is not supported by your browser.');
    return;
  }

  setLoading(true);

  navigator.geolocation.getCurrentPosition(

    function (position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      getWeatherByCoordinates(lat, lon);
    },
    function () {
      setLoading(false);
      showError('Could not get your location. Please allow location access, or search by city name instead.');
    }
  );
});

getWeatherByCity('London'); 