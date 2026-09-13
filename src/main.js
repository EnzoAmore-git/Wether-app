import './styles.css';

const app = document.getElementById('app');

const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_API = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const GEOCODE_KEY = '';


let timerInterval = null;


function showError(message, isLoading = false) {
  app.innerHTML = `
    <div style="text-align: center; padding: 40px; color: white;">
      ${isLoading ? '<h2 style="margin-bottom: 16px;">Определение местоположения...</h2>' : '<h2 style="margin-bottom: 16px;">Ошибка</h2>'}
      <p style="margin-bottom: 24px; font-size: 16px;">${message}</p>
      <button id="retryBtn" style="padding: 12px 24px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">Повторить</button>
    </div>
  `;

  document.getElementById('retryBtn').addEventListener('click', initApp);
}


function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${hours}:${minutes} ${day}.${month}.${year}`;
}


function updateTime() {
  const now = new Date();
  const timeElement = document.querySelector('.time-value');
  if (timeElement) {
    timeElement.textContent = formatTime(now);
  }
}


function startTimeUpdates() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(updateTime, 60000);
  updateTime();
}


async function getCityFromCoords(lat, lon) {
  try {
    const response = await fetch(`${GEOCODE_API}?latitude=${lat}&longitude=${lon}&localityLanguage=ru`);
    if (!response.ok) throw new Error('Reverse geocoding failed');
    const data = await response.json();
    return data.city || data.village || data.zip || `Широта: ${lat}, Долгота: ${lon}`;
  } catch (error) {
    console.error('Ошибка reverse geocoding:', error);
    return `Координаты: ${lat}, ${lon}`;
  }
}


async function getWeather(lat, lon) {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      current_weather: 'true',
      hourly: 'temperature_2m,relativehumidity_2m,pressure_msl,weathercode',
      timezone: 'auto'
    });

    const response = await fetch(`${WEATHER_API}?${params}`);
    if (!response.ok) throw new Error('Weather API failed');

    const data = await response.json();
    console.log('Weather data:', data);

    const current = data.current_weather;
    const temperature = current.temperature;
    const weathercode = current.weathercode;

    const weatherDescriptions = {
      0: 'Ясно',
      1: 'В основном ясно',
      2: 'Частично облачно',
      3: 'Облачно',
      45: 'Туман',
      48: 'Исходящий туман',
      51: 'Легкий дождь',
      53: 'Умеренный дождь',
      55: 'Интенсивный дождь',
      61: 'Дождь',
      63: 'Сильный дождь',
      65: 'Очень сильный дождь',
      71: 'Снег',
      73: 'Ливневый снег',
      80: 'Ливень',
      95: 'Гроза',
      96: 'Гроза с градом',
      99: 'Сильная гроза'
    };

    const description = weatherDescriptions[weathercode] || 'Неизвестно';

    const humidity = data.hourly?.relativehumidity_2m?.[0] || 0;
    const pressure = data.hourly?.pressure_msl?.[0] || 1013;

    const cityName = await getCityFromCoords(lat, lon);

    return {
      temperature,
      description,
      humidity,
      pressure,
      city: cityName,
      weathercode
    };
  } catch (error) {
    console.error('Ошибка загрузки погоды:', error);
    throw error;
  }
}


function renderWeather(weather) {
  const date = new Date();
  const currentTime = formatTime(date);

  app.innerHTML = `
    <div id="weatherCard" class="weather-card">
      <div>
        <h1>Погода</h1>
        <div class="city-name" id="cityName">${weather.city}</div>
        <div class="time-value" id="currentTime">${currentTime}</div>
      </div>

      <div class="temperature" id="temperature">${weather.temperature}°C</div>
      <div class="description" id="description">${weather.description}</div>

      <div class="details">
        <div class="detail-item">
          <span class="detail-icon">💧</span>
          <span class="detail-label">Влажность</span>
          <span class="detail-value" id="humidity">${weather.humidity}%</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">️</span>
          <span class="detail-label">Давление</span>
          <span class="detail-value" id="pressure">${weather.pressure} гПа</span>
        </div>
        <div class="detail-item">
          <span class="detail-icon">🌡️</span>
          <span class="detail-label">Температура</span>
          <span class="detail-value" id="tempValue">${weather.temperature}°C</span>
        </div>
      </div>
    </div>

    <button class="update-btn" id="updateBtn">↻</button>
  `;

  startTimeUpdates();

  document.getElementById('updateBtn').addEventListener('click', () => {
    const lat = parseFloat(app.dataset.lat);
    const lon = parseFloat(app.dataset.lon);
    if (lat && lon) {
      getWeather(lat, lon).then(renderWeather).catch(showError);
    }
  });
}


async function initApp() {
  if (!navigator.geolocation) {
    showError('Геолокация не поддерживается браузером');
    return;
  }

  showError('Определение местоположения...', true);

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      console.log('Координаты:', lat, lon);

      // Store coordinates on app element for update button
      app.dataset.lat = lat;
      app.dataset.lon = lon;

      try {
        const weather = await getWeather(lat, lon);
        console.log('Погода получена:', weather);

        renderWeather(weather);
      } catch (error) {
        showError('Не удалось загрузить погоду');
      }
    },
    (error) => {
      console.error('Ошибка геолокации:', error);
      showError('Доступ к геолокации отклонен');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}


initApp();