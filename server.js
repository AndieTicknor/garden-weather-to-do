const express = require('express');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3001;
const WEATHER_API_KEY = 'd1d0d0acd0fb8e8e26678128ee7a9a28'; // <-- Replace with your key

app.use(cors());
app.use(express.json());

const USERS_FILE = './users.json';

// Helper to read/write users
function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE));
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
  const { email, location } = req.body;
  if (!email || !location) return res.status(400).send('Missing email or location');
  const users = getUsers();
  if (!users.find(u => u.email === email)) {
    users.push({ email, location });
    saveUsers(users);
  }
  res.sendStatus(200);
});

// Email transporter (Gmail example, use env vars for production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ticknorandrea@gmail.com',      // <-- Replace with your Gmail
    pass: 'enrf hvjd eads iftd'          // <-- Replace with your Gmail App Password
  }
});

// Helper to get weather and tasks
async function getWeatherAndTasks(location) {
  const weatherRes = await axios.get(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=metric&appid=${WEATHER_API_KEY}`
  );
  const data = weatherRes.data;
  const temp = data.main.temp;
  const description = data.weather[0].description;
  const humidity = data.main.humidity;
  const wind = data.wind.speed;

  // Simple task logic (customize as needed)
  const tasks = [];
  if (temp > 25) tasks.push('Water plants thoroughly');
  if (temp < 10) tasks.push('Protect sensitive plants from cold');
  if (description.includes('rain')) tasks.push('Check for waterlogged soil');
  if (humidity > 80) tasks.push('Check for fungal diseases');
  if (wind > 10) tasks.push('Secure loose garden items');

  return { temp, description, humidity, wind, tasks };
}

// Cron job: send emails every morning at 7am
cron.schedule('0 7 * * *', async () => {
  const users = getUsers();
  for (const user of users) {
    try {
      const { temp, description, humidity, wind, tasks } = await getWeatherAndTasks(user.location);
      const mailOptions = {
        from: 'ticknorandrea@gmail.com',
      to: email,
      subject: 'Your Garden Weather & Tasks Update (Test)',
      text: `Weather for ${location}:\nTemperature: ${temp}°C\nConditions: ${description}\nHumidity: ${humidity}%\nWind: ${wind} m/s\n\nToday's weather-related tasks:\n${tasks.length ? tasks.join('\n') : 'No specific tasks today.'}`,
      html: `<b>Weather for ${location}:</b><br>Temperature: ${temp}°C<br>Conditions: ${description}<br>Humidity: ${humidity}%<br>Wind: ${wind} m/s<br><br><b>Today's weather-related tasks:</b><br>${tasks.length ? tasks.map(t => t + '<br>').join('') : 'No specific tasks today.'}<br><br><a href="https://andieticknor.github.io/garden-weather-to-do/">Add tasks manually</a>`
      };
      await transporter.sendMail(mailOptions);
      console.log(`Email sent to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send email to ${user.email}:`, err.message);
    }
  }
});

app.post('/send-test-email', async (req, res) => {
  const { email, location } = req.body;
  if (!email || !location) return res.status(400).send('Missing email or location');
  try {
    const { temp, description, humidity, wind, tasks } = await getWeatherAndTasks(location);
    const mailOptions = {
      from: 'ticknorandrea@gmail.com',
      to: email,
      subject: 'Your Garden Weather & Tasks Update (Test)',
      text: `Weather for ${location}:\nTemperature: ${temp}°C\nConditions: ${description}\nHumidity: ${humidity}%\nWind: ${wind} m/s\n\nToday's weather-related tasks:\n${tasks.length ? tasks.join('\n') : 'No specific tasks today.'}`,
      html: `<b>Weather for ${location}:</b><br>Temperature: ${temp}°C<br>Conditions: ${description}<br>Humidity: ${humidity}%<br>Wind: ${wind} m/s<br><br><b>Today's weather-related tasks:</b><br>${tasks.length ? tasks.map(t => t + '<br>').join('') : 'No specific tasks today.'}<br><br><a href="https://andieticknor.github.io/garden-weather-to-do/">Add tasks manually</a>`
    };
    await transporter.sendMail(mailOptions);
    res.send('Test email sent!');
  } catch (err) {
    res.status(500).send('Failed to send test email: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));