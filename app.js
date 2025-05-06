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
    weatherSummary.textContent = 'Location needed';
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
    
    if (location) {
        savedLocation = location;
        localStorage.setItem('gardenLocation', location);
        fetchWeatherData(location);
        fetchForecast(location);
    }
}

// Handle task form submission
function handleTaskSubmit(e) {
    e.preventDefault();
    const taskText = taskInput.value.trim();
    
    if (taskText) {
        addTask(taskText);
        taskInput.value = '';
    }
}

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
            throw new Error('Weather data not available');
        }
        
        const data = await response.json();
        displayWeatherData(data);
        suggestTasks(data);
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
            <p><strong>Temperature:</strong> ${tempC}°C / ${tempF}°F</p>
            <p><strong>Conditions:</strong> ${description}</p>
            <p><strong>Humidity:</strong> ${humidity}%</p>
            <p><strong>Wind Speed:</strong> ${windSpeedMph} mph</p>
        </div>
    `;
    
    weatherSummary.textContent = `${tempC}°C / ${tempF}°F, ${description}`;
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
                forecasts: []
            };
        }
        acc[dateKey].forecasts.push(forecast);
        return acc;
    }, {});
    
    // Convert to array and sort by date
    const dailyForecasts = Object.values(forecastsByDay)
        .sort((a, b) => a.date - b.date)
        .slice(0, 3); // Get next 3 days
    
    forecastScroll.innerHTML = dailyForecasts.map(day => {
        // Get the forecast for noon (or closest available time)
        const noonForecast = day.forecasts.reduce((closest, current) => {
            const currentHour = new Date(current.dt * 1000).getHours();
            const closestHour = new Date(closest.dt * 1000).getHours();
            return Math.abs(currentHour - 12) < Math.abs(closestHour - 12) ? current : closest;
        });
        
        const tempC = Math.round(noonForecast.main.temp);
        const tempF = celsiusToFahrenheit(noonForecast.main.temp);
        const windSpeedMps = noonForecast.wind.speed;
        const windSpeedMph = metersPerSecondToMph(windSpeedMps);
        const tasks = suggestTasksForForecast(noonForecast);
        
        return `
            <div class="forecast-card">
                <h3>${day.date.toLocaleDateString('en-US', { weekday: 'long' })}</h3>
                <div class="forecast-date">${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div class="forecast-weather">
                    <p><strong>Temperature:</strong> ${tempC}°C / ${tempF}°F</p>
                    <p><strong>Conditions:</strong> ${noonForecast.weather[0].description}</p>
                    <p><strong>Humidity:</strong> ${noonForecast.main.humidity}%</p>
                    <p><strong>Wind:</strong> ${windSpeedMph} mph</p>
                </div>
                <div class="forecast-tasks">
                    <h4>Suggested Tasks</h4>
                    ${tasks.map(task => `<div class="forecast-task-item">${task}</div>`).join('')}
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
document.addEventListener('DOMContentLoaded', init); 