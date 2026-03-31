let currentUser = null;
let currentToken = null;
let approvedData = null;

const themeToggle = document.getElementById('themeToggle');
const htmlEl = document.documentElement;

function initTheme() {
  const saved = localStorage.getItem('theme');
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && darkMode)) {
    htmlEl.setAttribute('data-theme', 'dark');
  } else {
    htmlEl.removeAttribute('data-theme');
  }
}

function toggleTheme() {
  if (htmlEl.getAttribute('data-theme') === 'dark') {
    htmlEl.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    htmlEl.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}
initTheme();

// === АВТОРИЗАЦИЯ ===
async function login() {
  const u = document.getElementById('loginUser').value;
  const p = document.getElementById('loginPass').value;
  if (!u || !p) return alert('Введите логин и пароль');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      currentToken = data.token;
      currentUser = { role: data.role };
      document.getElementById('loginForm').style.display = 'none';
      document.getElementById('mainInterface').style.display = 'block';
      document.getElementById('userInfo').textContent = `👤 ${u} (${data.role})`;
      if (data.role === 'developer') {
        document.getElementById('adminPanelBtn').style.display = 'block';
      }
      loadApprovedData();
    } else {
      alert(data.error || 'Ошибка входа');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Ошибка соединения с сервером');
  }
}

async function register() {
  const u = document.getElementById('regUser').value;
  const p = document.getElementById('regPass').value;
  if (!u || !p) return alert('Введите логин и пароль');
  if (p.length < 8) return alert('Пароль должен быть минимум 8 символов');

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Регистрация успешна!');
      showLogin();
    } else {
      alert(data.error || 'Ошибка регистрации');
    }
  } catch (error) {
    console.error('Register error:', error);
    alert('Ошибка соединения с сервером');
  }
}

function showLogin() {
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
}

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

function logout() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('token');
  document.getElementById('mainInterface').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('adminPanelBtn').style.display = 'none';
}

// === ЗАГРУЗКА ДАННЫХ ===
async function loadApprovedData() {
  try {
    const res = await fetch('/api/approved-data', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (!res.ok) throw new Error('Failed to load data');
    approvedData = await res.json();
    updateLocationSelects();
  } catch (error) {
    console.error('Error loading data:', error);
    alert('Ошибка загрузки данных');
  }
}

function updateLocationSelects() {
  const fromSel = document.getElementById('fromSelect');
  const toSel = document.getElementById('toSelect');
  const newFromSel = document.getElementById('newRouteFrom');
  const newToSel = document.getElementById('newRouteTo');

  [fromSel, toSel, newFromSel, newToSel].forEach(sel => {
    if (sel) {
      sel.innerHTML = '<option>Выберите локацию</option>';
    }
  });

  if (approvedData?.locations?.length > 0) {
    approvedData.locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.name;
      [fromSel, toSel, newFromSel, newToSel].forEach(sel => {
        if (sel) sel.appendChild(opt.cloneNode(true));
      });
    });
  }
}

async function loadApprovedList() {
  const data = approvedData; // уже загружено через /api/approved-data
  
  const list = document.getElementById('approvedList');
  list.innerHTML = '';

  // Локации
  data.locations.forEach(loc => {
    const el = document.createElement('div');
    el.className = 'submission-item';
    el.innerHTML = `
      <strong>📍 ${loc.name}</strong>
      <div class="submission-actions">
        <button onclick="deleteLocation(${loc.id})" class="btn btn-ghost">🗑️ Удалить</button>
      </div>
    `;
    list.appendChild(el);
  });

  // Маршруты
  Object.entries(data.routes).forEach(([key, url]) => {
    const [fromId, toId] = key.split('|').map(Number);
    const fromName = data.locations.find(l => l.id === fromId)?.name || '???';
    const toName = data.locations.find(l => l.id === toId)?.name || '???';

    const el = document.createElement('div');
    el.className = 'submission-item';
    el.innerHTML = `
      <strong>🎬 ${fromName} → ${toName}</strong><br>
      <small>${url}</small>
      <div class="submission-actions">
        <button onclick="deleteRoute(${fromId}, ${toId})" class="btn btn-ghost">🗑️ Удалить</button>
      </div>
    `;
    list.appendChild(el);
  });
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОБРАБОТКИ URL ===

// Извлекает src из iframe, если передан код iframe
function extractVideoUrl(input) {
  const iframeMatch = input.match(/<iframe.*src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1];
  }
  return input;
}

// Преобразует обычную ссылку RuTube в embed-ссылку для встраивания
function convertToEmbedUrl(url) {
  const rutubeMatch = url.match(/rutube\.ru\/video\/([a-f0-9]+)/i);
  if (rutubeMatch && rutubeMatch[1]) {
    return `https://rutube.ru/play/embed/${rutubeMatch[1]}/`;
  }
  return url;
}

// === ВОСПРОИЗВЕДЕНИЕ ===
function playRoute() {
  const fromSelect = document.getElementById('fromSelect');
  const toSelect = document.getElementById('toSelect');
  const playerContainer = document.getElementById('player');

  if (!fromSelect || !toSelect || !playerContainer) {
    console.error('Элементы интерфейса не найдены');
    return;
  }

  const a = fromSelect.value;
  const b = toSelect.value;
  if (!a || !b || a === b) {
    console.log('Выберите разные точки');
    return;
  }

  const routeKey = `${a}|${b}`;
  let route = approvedData?.routes?.[routeKey];
  if (!route) {
    console.log('Видео не найдено');
    return;
  }

  // Если строка — преобразуем её (из iframe или обычной rutube ссылки)
  if (typeof route === 'string') {
    route = extractVideoUrl(route);
    route = convertToEmbedUrl(route);
  } else if (route && typeof route === 'object') {
    // Если в будущем будет объект с полем url, обработаем и его
    if (route.url) {
      let url = extractVideoUrl(route.url);
      url = convertToEmbedUrl(url);
      route.url = url;
    }
  }

  playerContainer.innerHTML = '';

  if (typeof route === 'string') {
    if (route.includes('.mp4') || route.includes('.m3u8')) {
      const video = document.createElement('video');
      video.src = route;
      video.controls = true;
      video.style.width = '100%';
      playerContainer.appendChild(video);
      video.play();
    } else if (route.includes('rutube.ru/play/embed/')) {
      const iframe = document.createElement('iframe');
      iframe.src = route.trim();
      iframe.width = '100%';
      iframe.height = '400';
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      playerContainer.appendChild(iframe);
    } else {
      // Если ссылка не распознана, пробуем всё равно вставить как iframe (надежда на поддержку)
      const iframe = document.createElement('iframe');
      iframe.src = route.trim();
      iframe.width = '100%';
      iframe.height = '400';
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      playerContainer.appendChild(iframe);
    }
  } else if (route && typeof route === 'object') {
    // Обработка объекта (если данные хранятся в таком виде)
    if (route.type === 'rutube') {
      const iframe = document.createElement('iframe');
      iframe.src = route.url.trim();
      iframe.width = '100%';
      iframe.height = '400';
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      playerContainer.appendChild(iframe);
    } else if (route.url) {
      const video = document.createElement('video');
      video.src = route.url;
      video.controls = true;
      video.style.width = '100%';
      playerContainer.appendChild(video);
      video.play();
    }
  }
}

// === ДОБАВЛЕНИЕ КОНТЕНТА ===
async function addLocation() {
  const name = document.getElementById('newLocationName')?.value?.trim();
  if (!name) return alert('Введите название локации');
  try {
    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Локация отправлена на модерацию');
      document.getElementById('newLocationName').value = '';
    } else {
      alert(data.error || 'Ошибка добавления локации');
    }
  } catch (error) {
    console.error('Error adding location:', error);
    alert('Ошибка соединения с сервером');
  }
}

async function addRoute() {
  const from = document.getElementById('newRouteFrom')?.value;
  const to = document.getElementById('newRouteTo')?.value;
  let videoUrl = document.getElementById('newVideoUrl')?.value?.trim();

  if (!from || !to) return alert('Выберите начальную и конечную локации');
  if (from === to) return alert('Локации не могут совпадать');
  if (!videoUrl) return alert('Введите URL видео');

  // Извлекаем src из iframe, если вставлен код
  videoUrl = extractVideoUrl(videoUrl);

  // Дополнительная проверка: URL должен начинаться с http:// или https://
  if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
    return alert('Некорректный URL. Вставьте прямую ссылку на видео или iframe.');
  }

  try {
    const res = await fetch('/api/routes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ fromLocationId: from, toLocationId: to, videoUrl })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Маршрут отправлен на модерацию');
      document.getElementById('newVideoUrl').value = '';
    } else {
      alert(data.error || 'Ошибка добавления маршрута');
    }
  } catch (error) {
    console.error('Error adding route:', error);
    alert('Ошибка соединения с сервером');
  }
}

// === АДМИНКА ===
function openAdminPanel() {
  document.getElementById('adminModal').style.display = 'flex';
  loadPendingSubmissions();
}

function closeAdminPanel() {
  document.getElementById('adminModal').style.display = 'none';
}

function openTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
  if (tabName === 'approvedTab') loadApprovedList();
}

async function loadPendingSubmissions() {
  try {
    const res = await fetch('/api/pending-submissions', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (!res.ok) throw new Error('Failed to load submissions');
    const submissions = await res.json();
    const list = document.getElementById('pendingList');
    list.innerHTML = submissions.length ? '' : '<p>Нет ожидающих заявок</p>';
    submissions.forEach(sub => {
      const item = document.createElement('div');
      item.className = 'submission-item';
      let content = '';
      if (sub.type === 'location') {
        content = `<strong>Локация:</strong> ${sub.data.name}<br><small>От: ${sub.submittedBy} (${new Date(sub.timestamp).toLocaleString()})</small>`;
      } else if (sub.type === 'route') {
        content = `<strong>Маршрут:</strong> ${sub.data.fromLocationName} → ${sub.data.toLocationName}<br><strong>Видео:</strong> ${sub.data.videoUrl}<br><small>От: ${sub.submittedBy} (${new Date(sub.timestamp).toLocaleString()})</small>`;
      }
      item.innerHTML = content + `
        <div class="submission-actions">
          <button onclick="approveSubmission(${sub.id})" class="btn btn-primary">✅ Одобрить</button>
          <button onclick="rejectSubmission(${sub.id})" class="btn btn-ghost">❌ Отклонить</button>
        </div>`;
      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading submissions:', error);
    alert('Ошибка загрузки заявок');
  }
}

async function loadLogs() {
  try {
    const res = await fetch('/api/logs', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (!res.ok) throw new Error('Failed to load logs');
    const logs = await res.json();
    const list = document.getElementById('logsList');
    list.innerHTML = logs.length ? '' : '<p>Логи отсутствуют</p>';
    logs.forEach(logItem => {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <strong>${logItem.action}</strong><br>
        <small>Пользователь: ${logItem.user} (${logItem.role})</small><br>
        <small>Время: ${new Date(logItem.timestamp).toLocaleString()}</small>
        ${logItem.details ? `<br><small>Детали: ${JSON.stringify(logItem.details)}</small>` : ''}
      `;
      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading logs:', error);
    alert('Ошибка загрузки логов');
  }
}

async function deleteLocation(id) {
  if (!confirm('Удалить локацию и все связанные маршруты?')) return;
  try {
    const res = await fetch(`/api/locations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      alert('Удалено');
      loadApprovedData(); // перезагрузить данные
      loadApprovedList(); // обновить список
    } else {
      alert('Ошибка удаления');
    }
  } catch (e) { console.error(e); alert('Ошибка'); }
}

async function deleteRoute(fromId, toId) {
  if (!confirm('Удалить маршрут?')) return;
  try {
    const res = await fetch(`/api/routes/${fromId}/${toId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      alert('Удалено');
      loadApprovedData();
      loadApprovedList();
    } else {
      alert('Ошибка удаления');
    }
  } catch (e) { console.error(e); alert('Ошибка'); }
}

async function approveSubmission(id) {
  try {
    const res = await fetch(`/api/submissions/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      alert('Заявка одобрена');
      loadPendingSubmissions();
      loadApprovedData();
    } else {
      alert('Ошибка одобрения заявки');
    }
  } catch (error) {
    console.error('Error approving submission:', error);
    alert('Ошибка одобрения заявки');
  }
}

async function rejectSubmission(id) {
  if (!confirm('Вы уверены?')) return;
  try {
    const res = await fetch(`/api/submissions/${id}/reject`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    if (res.ok) {
      alert('Заявка отклонена');
      loadPendingSubmissions();
    } else {
      alert('Ошибка отклонения заявки');
    }
  } catch (error) {
    console.error('Error rejecting submission:', error);
    alert('Ошибка отклонения заявки');
  }
}

// === ИНИЦИАЛИЗАЦИЯ ===
window.onload = () => {
  const token = localStorage.getItem('token');
  if (token) {
    currentToken = token;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('mainInterface').style.display = 'block';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUser = { role: payload.role, username: payload.username };
      document.getElementById('userInfo').textContent = `👤 ${payload.username} (${payload.role})`;
      if (payload.role === 'developer') {
        document.getElementById('adminPanelBtn').style.display = 'block';
      }
    } catch (e) {
      console.error('Invalid token:', e);
      logout();
    }
    loadApprovedData();
  } else {
    showLogin();
  }

  const applyBtn = document.getElementById('applyBtn');
  if (applyBtn) applyBtn.addEventListener('click', playRoute);

  const adminBtn = document.getElementById('adminPanelBtn');
  if (adminBtn) adminBtn.addEventListener('click', openAdminPanel);
};