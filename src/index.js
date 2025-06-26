const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

// Allowed front-end origins
const allowedOrigins = [
  'https://hifi-horizon-mmf-1.onrender.com',
  'https://hifi-horizon-mmf-2.onrender.com',
  'http://localhost:5173',
  'https://hifi-mmf.netlify.app',
  'https://hifi-horizon-mmf.onrender.com',
];

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// File path for user data
const USERS_FILE = path.resolve(__dirname, 'users.json');

// Ensure file exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
}

// Load users from file
function loadUsers() {
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data).users || [];
}

// Save users to file
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

// ------------------- ROUTES -------------------

// Register new user
app.post('/api/register', async (req, res) => {
  const { email, password, fullname, phone, address1, address2, city, zipcode, country } = req.body;
  if (!email || !password || !fullname) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const users = loadUsers();
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  users.push({
    email,
    password: hashedPassword,
    fullname,
    phone,
    address1,
    address2,
    city,
    zipcode,
    country,
  });

  saveUsers(users);
  res.status(201).json({ message: 'User registered', user: { email, fullname } });
});

// Login user
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

// Get user profile
app.get('/api/profile', (req, res) => {
  const { email } = req.query;
  const users = loadUsers();
  const user = users.find(u => u.email === email);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { password, ...safeUser } = user;
  res.json(safeUser);
});

// Delete user profile
app.delete('/api/profile', (req, res) => {
  const email = req.body.email || req.query.email;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  let users = loadUsers();
  const userIndex = users.findIndex(u => u.email === email);
  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  users.splice(userIndex, 1);
  saveUsers(users);
  res.json({ message: 'User deleted' });
});

// Update user profile
app.patch('/api/profile', (req, res) => {
  const { email, ...updates } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const users = loadUsers();
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  Object.keys(updates).forEach(key => {
    if (key !== 'email') {
      user[key] = updates[key];
    }
  });

  saveUsers(users);
  res.json({ message: 'Profile updated' });
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: `Contact Form Message from ${name}`,
      text: message,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    res.status(200).send({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).send({ error: 'Failed to send email. Please try again later.' });
  }
});

// CORS test endpoint
app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS is working!' });
});

// CORS fallback headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", allowedOrigins.join(", "));
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Default route
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (process.env.RENDER) {
    console.log('Running on Render. Public URL will be provided by Render dashboard.');
  }
});
