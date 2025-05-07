// Weather API configuration
const WEATHER_API_KEY = 'd1d0d0acd0fb8e8e26678128ee7a9a28';
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';

// Helper function to convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius) {
    return Math.round((celsius * 9/5) + 32);
}

// Helper function to convert m/s to mph
function metersPerSecondToMph(mps) {
    return Math.round(mps * 2.237);
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// DOM Elements
const weatherInfo = document.getElementById('weather-info');
const weatherSummary = document.getElementById('weather-summary');
const suggestedTasks = document.getElementById('suggested-tasks');
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task-input');
const tasksList = document.getElementById('tasks');
const locationForm = document.getElementById('location-form');
const locationInput = document.getElementById('location');
const forecastScroll = document.getElementById('forecast-scroll');

// Load saved data
let savedLocation = localStorage.getItem('gardenLocation') || '';
let savedTasks = JSON.parse(localStorage.getItem('gardenTasks')) || [];

// Tooltip label mapping
const weatherIconLabels = {
    'fa-thermometer-half': 'Temperature',
    'fa-cloud-sun': 'Conditions',
    'fa-tint': 'Humidity',
    'fa-wind': 'Wind Speed'
};

function setupWeatherIconTooltips() {
    const tooltip = document.getElementById('weather-tooltip');
    function showTooltip(e, label) {
        tooltip.textContent = label;
        tooltip.style.display = 'block';
        tooltip.classList.add('show');
        tooltip.style.left = (e.clientX + 16) + 'px';
        tooltip.style.top = (e.clientY - 8) + 'px';
    }
    function hideTooltip() {
        tooltip.classList.remove('show');
        tooltip.style.display = 'none';
    }
    document.body.addEventListener('mouseover', function(e) {
        if (e.target.tagName === 'I' && e.target.dataset.label) {
            showTooltip(e, e.target.dataset.label);
        }
    });
    document.body.addEventListener('mousemove', function(e) {
        if (tooltip.classList.contains('show')) {
            tooltip.style.left = (e.clientX + 16) + 'px';
            tooltip.style.top = (e.clientY - 8) + 'px';
        }
    });
    document.body.addEventListener('mouseout', function(e) {
        if (e.target.tagName === 'I' && e.target.dataset.label) {
            hideTooltip();
        }
    });
}

// Initialize the app
function init() {
    locationInput.value = savedLocation;
    
    if (savedLocation) {
        fetchWeatherData(savedLocation);
        fetchForecast(savedLocation);
    } else {
        showLocationPrompt();
    }
    
    // Set up event listeners
    locationForm.addEventListener('submit', handleLocationSubmit);
    taskForm.addEventListener('submit', handleTaskSubmit);
    
    // Render saved tasks
    renderTasks();
}

// Show location prompt
function showLocationPrompt() {
    weatherInfo.innerHTML = `
        <div class="location-prompt">
            <p>Please enter your ZIP Code to get weather-based garden tasks.</p>
            <form id="prompt-location-form" class="prompt-form">
                <input type="text" id="prompt-location" placeholder="Enter your location" required>
                <button type="submit">Get Weather</button>
            </form>
        </div>
    `;
    
    suggestedTasks.innerHTML = '<p>Enter your location to see suggested tasks</p>';
    weatherSummary.textContent = '';
    forecastScroll.innerHTML = '<p>Enter your location to see forecast</p>';
    
    // Add event listener to the prompt form
    document.getElementById('prompt-location-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const location = document.getElementById('prompt-location').value.trim();
        if (location) {
            savedLocation = location;
            localStorage.setItem('gardenLocation', location);
            locationInput.value = location;
            fetchWeatherData(location);
            fetchForecast(location);
        }
    });
}

// Handle location form submission
function handleLocationSubmit(e) {
    e.preventDefault();
    const location = locationInput.value.trim();
    const errorId = 'location-error';
    let errorElem = document.getElementById(errorId);
    if (!location) {
        if (!errorElem) {
            errorElem = document.createElement('div');
            errorElem.id = errorId;
            errorElem.className = 'input-error';
            errorElem.textContent = 'Please enter a location.';
            locationInput.classList.add('input-error-border');
            locationForm.appendChild(errorElem);
        }
        return;
    } else if (errorElem) {
        errorElem.remove();
        locationInput.classList.remove('input-error-border');
    }
    savedLocation = location;
    localStorage.setItem('gardenLocation', location);
    fetchWeatherData(location);
    fetchForecast(location);
}

locationInput.addEventListener('input', function() {
    const errorElem = document.getElementById('location-error');
    if (errorElem && locationInput.value.trim()) {
        errorElem.remove();
        locationInput.classList.remove('input-error-border');
    }
});

// Handle task form submission
function handleTaskSubmit(e) {
    e.preventDefault();
    const taskText = taskInput.value.trim();
    const errorId = 'task-error';
    let errorElem = document.getElementById(errorId);
    if (!taskText) {
        if (!errorElem) {
            errorElem = document.createElement('div');
            errorElem.id = errorId;
            errorElem.className = 'input-error';
            errorElem.textContent = 'Please enter a task.';
            taskInput.classList.add('input-error-border');
            taskForm.appendChild(errorElem);
        }
        return;
    } else if (errorElem) {
        errorElem.remove();
        taskInput.classList.remove('input-error-border');
    }
    addTask(taskText);
    taskInput.value = '';
}

taskInput.addEventListener('input', function() {
    const errorElem = document.getElementById('task-error');
    if (errorElem && taskInput.value.trim()) {
        errorElem.remove();
        taskInput.classList.remove('input-error-border');
    }
});

// Add a new task
function addTask(text) {
    const task = {
        id: Date.now(),
        text,
        completed: false
    };
    
    savedTasks.push(task);
    saveTasks();
    renderTasks();
}

// Delete a task
function deleteTask(id) {
    savedTasks = savedTasks.filter(task => task.id !== id);
    saveTasks();
    renderTasks();
}

// Toggle task completion
function toggleTask(id) {
    savedTasks = savedTasks.map(task => {
        if (task.id === id) {
            return { ...task, completed: !task.completed };
        }
        return task;
    });
    saveTasks();
    renderTasks();
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem('gardenTasks', JSON.stringify(savedTasks));
}

// Render tasks
function renderTasks() {
    tasksList.innerHTML = savedTasks
        .map(task => `
            <li class="task-item ${task.completed ? 'completed' : ''}">
                <input type="checkbox" 
                       ${task.completed ? 'checked' : ''} 
                       onchange="toggleTask(${task.id})">
                <span>${task.text}</span>
                <button class="delete-task" onclick="deleteTask(${task.id})">×</button>
            </li>
        `)
        .join('');
}

// Fetch weather data
async function fetchWeatherData(location) {
    try {
        weatherInfo.innerHTML = '<p>Loading weather data...</p>';
        suggestedTasks.innerHTML = '<p>Loading suggested tasks...</p>';
        
        const response = await fetch(
            `${WEATHER_API_URL}/weather?q=${location}&units=metric&appid=${WEATHER_API_KEY}`
        );
        
        if (!response.ok) {
            if (response.status === 404) {
                weatherInfo.innerHTML = `<div class="location-prompt"><p>Location not found. Please enter your ZIP Code to get weather-based garden tasks.</p><form id="prompt-location-form" class="prompt-form"><input type="text" id="prompt-location" placeholder="Enter your location" required><button type="submit">Get Weather</button></form></div>`;
                suggestedTasks.innerHTML = '<p>Enter your location to see suggested tasks</p>';
                // Add event listener to the prompt form
                document.getElementById('prompt-location-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    const newLocation = document.getElementById('prompt-location').value.trim();
                    if (newLocation) {
                        savedLocation = newLocation;
                        localStorage.setItem('gardenLocation', newLocation);
                        locationInput.value = newLocation;
                        fetchWeatherData(newLocation);
                        fetchForecast(newLocation);
                    }
                });
                return;
            } else {
                throw new Error('Weather data not available');
            }
        }
        
        const data = await response.json();
        displayWeatherData(data);
    } catch (error) {
        weatherInfo.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        suggestedTasks.innerHTML = '<p>Unable to suggest tasks due to weather data error</p>';
    }
}

// Display weather data
function displayWeatherData(data) {
    const tempC = Math.round(data.main.temp);
    const tempF = celsiusToFahrenheit(data.main.temp);
    const description = data.weather[0].description;
    const humidity = data.main.humidity;
    const windSpeedMps = data.wind.speed;
    const windSpeedMph = metersPerSecondToMph(windSpeedMps);
    
    weatherInfo.innerHTML = `
        <div class="weather-details">
            <p><i class="fas fa-thermometer-half" data-label="Temperature"></i> ${tempF}°F / ${tempC}°C</p>
            <p><i class="fas fa-cloud-sun" data-label="Conditions"></i> ${description}</p>
            <p><i class="fas fa-tint" data-label="Humidity"></i> ${humidity}%</p>
            <p><i class="fas fa-wind" data-label="Wind Speed"></i> ${windSpeedMph} mph</p>
        </div>
    `;
    
    weatherSummary.textContent = `${tempF}°F / ${tempC}°C, ${description}`;
    
    // Suggest tasks immediately after displaying weather
    suggestTasks(data);
}

// Suggest tasks based on weather
function suggestTasks(data) {
    const tasks = [];
    const temp = data.main.temp;
    const description = data.weather[0].main.toLowerCase();
    const humidity = data.main.humidity;
    const windSpeed = data.wind.speed;
    
    // Temperature-based tasks
    if (temp > 25) {
        tasks.push('Water plants thoroughly');
        tasks.push('Check for signs of heat stress');
    } else if (temp < 10) {
        tasks.push('Protect sensitive plants from cold');
        tasks.push('Check for frost damage');
    }
    
    // Weather condition tasks
    if (description.includes('rain')) {
        tasks.push('Check for waterlogged soil');
        tasks.push('Inspect for drainage issues');
    } else if (description.includes('clear')) {
        tasks.push('Apply sun protection to sensitive plants');
    }
    
    // Humidity-based tasks
    if (humidity > 80) {
        tasks.push('Check for fungal diseases');
        tasks.push('Improve air circulation');
    } else if (humidity < 40) {
        tasks.push('Mist humidity-loving plants');
    }
    
    // Wind-based tasks
    if (windSpeed > 10) {
        tasks.push('Secure loose garden items');
        tasks.push('Check for wind damage');
    }
    
    // Display suggested tasks
    if (tasks.length > 0) {
        suggestedTasks.innerHTML = tasks
            .map(task => `<div class="suggested-task">${task}</div>`)
            .join('');
    } else {
        suggestedTasks.innerHTML = '<p>No specific tasks suggested for current weather conditions</p>';
    }
}

// Fetch forecast data
async function fetchForecast(location) {
    try {
        forecastScroll.innerHTML = '<p>Loading forecast...</p>';
        
        const response = await fetch(
            `${WEATHER_API_URL}/forecast?q=${location}&units=metric&appid=${WEATHER_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error('Forecast data not available');
        }
        
        const data = await response.json();
        displayForecast(data);
    } catch (error) {
        forecastScroll.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Display forecast data
function displayForecast(data) {
    // Get next 3 days of forecast
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    // Group forecasts by day
    const forecastsByDay = data.list.reduce((acc, forecast) => {
        const forecastDate = new Date(forecast.dt * 1000);
        forecastDate.setHours(0, 0, 0, 0);
        
        // Skip if it's today
        if (forecastDate.getTime() === today.getTime()) {
            return acc;
        }
        
        const dateKey = forecastDate.toISOString().split('T')[0];
        if (!acc[dateKey]) {
            acc[dateKey] = {
                date: forecastDate,
                forecasts: [],
                tempSum: 0,
                humiditySum: 0,
                windSum: 0,
                weatherCounts: {}
            };
        }
        
        // Add to running sums for averages
        acc[dateKey].tempSum += forecast.main.temp;
        acc[dateKey].humiditySum += forecast.main.humidity;
        acc[dateKey].windSum += forecast.wind.speed;
        
        // Count weather conditions
        const weatherMain = forecast.weather[0].main;
        acc[dateKey].weatherCounts[weatherMain] = (acc[dateKey].weatherCounts[weatherMain] || 0) + 1;
        
        acc[dateKey].forecasts.push(forecast);
        return acc;
    }, {});
    
    // Convert to array and sort by date
    const dailyForecasts = Object.values(forecastsByDay)
        .sort((a, b) => a.date - b.date)
        .slice(0, 3);
    
    forecastScroll.innerHTML = dailyForecasts.map(day => {
        // Calculate daily averages
        const forecastCount = day.forecasts.length;
        const avgTemp = Math.round(day.tempSum / forecastCount);
        const avgHumidity = Math.round(day.humiditySum / forecastCount);
        const avgWindSpeed = Math.round(day.windSum / forecastCount);
        
        // Get most common weather condition
        const mostCommonWeather = Object.entries(day.weatherCounts)
            .sort((a, b) => b[1] - a[1])[0][0];
        
        // Get weather description from the most common condition
        const weatherDescription = day.forecasts.find(f => f.weather[0].main === mostCommonWeather)
            .weather[0].description;
        
        const tempF = celsiusToFahrenheit(avgTemp);
        const windSpeedMph = metersPerSecondToMph(avgWindSpeed);
        const tasks = suggestTasksForForecast({
            main: {
                temp: avgTemp,
                humidity: avgHumidity
            },
            weather: [{ main: mostCommonWeather, description: weatherDescription }],
            wind: { speed: avgWindSpeed }
        });
        
        const dayName = day.date.toLocaleDateString('en-US', { weekday: 'long' });
        const monthName = day.date.toLocaleDateString('en-US', { month: 'long' });
        const dayOfMonth = day.date.getDate();
        const formattedDate = `${dayName}, ${monthName} ${dayOfMonth}`;
        
        return `
            <div class="forecast-card">
                <h3>${formattedDate}</h3>
                <div class="forecast-weather">
                    <p><i class="fas fa-thermometer-half" data-label="Temperature"></i> ${tempF}°F / ${avgTemp}°C</p>
                    <p><i class="fas fa-cloud-sun" data-label="Conditions"></i> ${weatherDescription}</p>
                    <p><i class="fas fa-tint" data-label="Humidity"></i> ${avgHumidity}%</p>
                    <p><i class="fas fa-wind" data-label="Wind Speed"></i> ${windSpeedMph} mph</p>
                </div>
                <div class="forecast-tasks">
                    <h4>Suggested Tasks:</h4>
                    <ul>
                        ${tasks.map(task => `<li class="forecast-task-item">${task}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }).join('');
}

// Suggest tasks based on forecast
function suggestTasksForForecast(forecast) {
    const tasks = [];
    const temp = forecast.main.temp;
    const description = forecast.weather[0].main.toLowerCase();
    const humidity = forecast.main.humidity;
    const windSpeed = forecast.wind.speed;
    
    // Temperature-based tasks
    if (temp > 25) {
        tasks.push('Plan for extra watering');
        tasks.push('Prepare shade for sensitive plants');
    } else if (temp < 10) {
        tasks.push('Prepare frost protection');
        tasks.push('Check greenhouse conditions');
    }
    
    // Weather condition tasks
    if (description.includes('rain')) {
        tasks.push('Check drainage systems');
        tasks.push('Prepare rain collection');
    } else if (description.includes('clear')) {
        tasks.push('Plan sun protection');
        tasks.push('Schedule watering');
    }
    
    // Humidity-based tasks
    if (humidity > 80) {
        tasks.push('Monitor for fungal growth');
        tasks.push('Improve air circulation');
    } else if (humidity < 40) {
        tasks.push('Prepare misting schedule');
        tasks.push('Check soil moisture');
    }
    
    // Wind-based tasks
    if (windSpeed > 10) {
        tasks.push('Secure garden structures');
        tasks.push('Protect tall plants');
    }
    
    return tasks;
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    init();
    setupWeatherIconTooltips();
}); 

// Email subscription form
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email-input');
const emailSuccess = document.getElementById('email-success');
const emailError = document.getElementById('email-error');

if (emailForm) {
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    emailSuccess.style.display = 'none';
    emailError.style.display = 'none';
    const email = emailInput.value.trim();
    const location = locationInput.value.trim();
    try {
      const res = await fetch('http://localhost:3001/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, location })
      });
      if (res.ok) {
        emailSuccess.style.display = 'block';
        emailInput.value = '';
      } else {
        emailError.style.display = 'block';
      }
    } catch {
      emailError.style.display = 'block';
    }
  });
}

const testEmailBtn = document.getElementById('test-email-btn');
const testEmailFeedback = document.getElementById('test-email-feedback');

if (testEmailBtn) {
  testEmailBtn.addEventListener('click', async () => {
    testEmailFeedback.style.display = 'none';
    const email = emailInput.value.trim();
    const location = locationInput.value.trim();
    if (!email || !location) {
      testEmailFeedback.style.display = 'block';
      testEmailFeedback.style.color = 'red';
      testEmailFeedback.textContent = 'Please enter both your email and location above.';
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, location })
      });
      const text = await res.text();
      testEmailFeedback.style.display = 'block';
      testEmailFeedback.style.color = res.ok ? 'green' : 'red';
      testEmailFeedback.textContent = text;
    } catch (err) {
      testEmailFeedback.style.display = 'block';
      testEmailFeedback.style.color = 'red';
      testEmailFeedback.textContent = 'Failed to send test email.';
    }
  });
}