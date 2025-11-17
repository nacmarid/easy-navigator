require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET;
const DATA_FILE = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!SECRET || SECRET === 'admen_API#52') {
  console.error('❌ CRITICAL: JWT_SECRET not set or using default value!');
  console.error('❌ Set JWT_SECRET in environment variables before deployment');
  process.exit(1);
}

const ensureDirectories = () => {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
};
ensureDirectories();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ✅ Статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts' },
});
app.use('/api/', generalLimiter);
app.use('/api/login', authLimiter);

const readData = () => {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Error reading data file:', error);
    return { 
      users: [], 
      pendingSubmissions: [], 
      approvedData: { locations: [], routes: {} },
      logs: []
    };
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data file:', error);
  }
};

// Функция для логирования
const addLog = (action, user, details = {}) => {
  const data = readData();
  const log = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    action,
    user: user.username,
    userId: user.id,
    role: user.role,
    details
  };
  data.logs.unshift(log);
  if (data.logs.length > 1000) {
    data.logs = data.logs.slice(0, 1000);
  }
  writeData(data);
  console.log(`📝 LOG: ${user.username} (${user.role}) - ${action}`);
};

if (!fs.existsSync(DATA_FILE)) {
  const devPass = bcrypt.hashSync('dev123', 12);
  writeData({
    users: [{ id: 1, username: 'admin', password: devPass, role: 'developer' }],
    pendingSubmissions: [],
    approvedData: { 
      locations: [
        { id: 1, name: "Арзамас 1" },
        { id: 2, name: "Арзамас 2" }
      ], 
      routes: {} 
    },
    logs: []
  });
  console.log('✅ Database initialized. Admin: admin / dev123');
}

const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Требуется вход' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Неверный токен' });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Нет прав' });
  next();
};

// Логи
app.get('/api/logs', authenticate, requireRole(['developer']), (req, res) => {
  const data = readData();
  res.json(data.logs);
});

// Вход
app.post('/api/login', [
  body('username').isLength({ min: 3 }),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const data = readData();
  const user = data.users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '24h' });
  
  const userInfo = { id: user.id, username: user.username, role: user.role };
  addLog('login', userInfo);
  
  res.json({ token, role: user.role });
});

// Регистрация
app.post('/api/register', [
  body('username').isLength({ min: 3, max: 30 }).withMessage('Логин должен быть от 3 до 30 символов'),
  body('password').isLength({ min: 8 }).withMessage('Пароль должен быть минимум 8 символов')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, password } = req.body;
  const data = readData();
  if (data.users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'Пользователь уже существует' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const newUser = { id: Date.now(), username, password: hash, role: 'user' };
  data.users.push(newUser);
  writeData(data);
  
  addLog('register', { id: newUser.id, username: newUser.username, role: newUser.role });
  
  res.status(201).json({ message: 'Регистрация успешна!' });
});

// Получение одобренных данных
app.get('/api/approved-data', authenticate, (req, res) => {
  const data = readData();
  res.json(data.approvedData);
});

// Добавление новой локации (user)
app.post('/api/locations', authenticate, [
  body('name').isLength({ min: 1 }).withMessage('Название локации обязательно')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name } = req.body;
  const data = readData();
  
  if (data.approvedData.locations.some(loc => loc.name === name)) {
    return res.status(409).json({ error: 'Локация с таким названием уже существует' });
  }

  const newLocation = { id: Date.now(), name };
  
  const submission = {
    id: Date.now(),
    type: 'location',
    data: newLocation,
    submittedBy: req.user.username,
    submittedById: req.user.id,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  data.pendingSubmissions.push(submission);
  writeData(data);
  
  addLog('add_location_submission', req.user, { locationName: name });
  
  res.status(201).json({ 
    message: 'Локация отправлена на модерацию',
    submissionId: submission.id
  });
});

// Добавление маршрута с видео (user)
app.post('/api/routes', authenticate, [
  body('fromLocationId').isInt({ min: 1 }).withMessage('ID начальной локации обязательно'),
  body('toLocationId').isInt({ min: 1 }).withMessage('ID конечной локации обязательно'),
  body('videoUrl').isURL().withMessage('URL видео обязателен и должен быть валидным')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { fromLocationId, toLocationId, videoUrl } = req.body;
  const data = readData();
  
  const fromLocation = data.approvedData.locations.find(loc => loc.id == fromLocationId);
  const toLocation = data.approvedData.locations.find(loc => loc.id == toLocationId);
  
  if (!fromLocation || !toLocation) {
    return res.status(404).json({ error: 'Одна из локаций не найдена' });
  }

  const routeKey = `${fromLocationId}|${toLocationId}`;
  
  if (data.approvedData.routes[routeKey]) {
    return res.status(409).json({ error: 'Маршрут уже существует' });
  }

  const submission = {
    id: Date.now(),
    type: 'route',
    data: {
      fromLocationId: parseInt(fromLocationId),
      toLocationId: parseInt(toLocationId),
      fromLocationName: fromLocation.name,
      toLocationName: toLocation.name,
      videoUrl
    },
    submittedBy: req.user.username,
    submittedById: req.user.id,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  data.pendingSubmissions.push(submission);
  writeData(data);
  
  addLog('add_route_submission', req.user, { 
    fromLocation: fromLocation.name, 
    toLocation: toLocation.name 
  });
  
  res.status(201).json({ 
    message: 'Маршрут отправлен на модерацию',
    submissionId: submission.id
  });
});

// Получение ожидающих submissions (developer)
app.get('/api/pending-submissions', authenticate, requireRole(['developer']), (req, res) => {
  const data = readData();
  res.json(data.pendingSubmissions);
});

// Утверждение submission (developer)
app.post('/api/submissions/:id/approve', authenticate, requireRole(['developer']), (req, res) => {
  const data = readData();
  const submission = data.pendingSubmissions.find(s => s.id == req.params.id);
  
  if (!submission) {
    return res.status(404).json({ error: 'Submission не найден' });
  }

  if (submission.type === 'location') {
    data.approvedData.locations.push(submission.data);
  } else if (submission.type === 'route') {
    const routeKey = `${submission.data.fromLocationId}|${submission.data.toLocationId}`;
    data.approvedData.routes[routeKey] = submission.data.videoUrl;
  }

  data.pendingSubmissions = data.pendingSubmissions.filter(s => s.id != req.params.id);
  writeData(data);
  
  addLog('approve_submission', req.user, { 
    submissionId: submission.id,
    type: submission.type,
    data: submission.data
  });
  
  res.json({ message: 'Submission утвержден' });
});

// Отклонение submission (developer)
app.post('/api/submissions/:id/reject', authenticate, requireRole(['developer']), (req, res) => {
  const data = readData();
  const submission = data.pendingSubmissions.find(s => s.id == req.params.id);
  
  if (!submission) {
    return res.status(404).json({ error: 'Submission не найден' });
  }

  data.pendingSubmissions = data.pendingSubmissions.filter(s => s.id != req.params.id);
  writeData(data);
  
  addLog('reject_submission', req.user, { 
    submissionId: submission.id,
    type: submission.type
  });
  
  res.json({ message: 'Submission отклонен' });
});

// ✅ Только корневой маршрут для SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен: http://localhost:${PORT}`);
  console.log(`✅ Статические файлы из: ${path.join(__dirname, 'public')}`);
});