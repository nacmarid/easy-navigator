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

async function login() {
  const u = document.getElementById('loginUser').value;
  const p = document.getElementById('loginPass').value;
  
  if (!u || !p) {
    alert('Введите логин и пароль');
    return;
  }
  
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
  
  if (!u || !p) {
    alert('Введите логин и пароль');
    return;
  }
  
  if (p.length < 8) {
    alert('Пароль должен быть минимум 8 символов');
    return;
  }
  
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    
    if (res.ok) {
      alert(data.message);
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
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  document.getElementById('regUser').value = '';
  document.getElementById('regPass').value = '';
}

function logout() {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('token');
  document.getElementById('mainInterface').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('userInfo').textContent = '';
  document.getElementById('adminPanelBtn').style.display = 'none';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

async function loadApprovedData() {
  try {
    const res = await fetch('/api/approved-data', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    
    if (!res.ok) {
      throw new Error('Failed to load data');
    }
    
    approvedData = await res.json();
    updateLocationSelects();
    
    const applyBtn = document.getElementById('applyBtn');
    if (applyBtn) {
      applyBtn.onclick = playRoute;
    }
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
      sel.innerHTML = '<option value="">Выберите локацию</option>';
    }
  });
  
  if (approvedData.locations && approvedData.locations.length > 0) {
    approvedData.locations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.name;
      
      [fromSel, toSel, newFromSel, newToSel].forEach(sel => {
        if (sel) {
          sel.appendChild(opt.cloneNode(true));
        }
      });
    });
  }
}

// Функция воспроизведения маршрута
function playRoute() {
  const a = pointA.value;
  const b = pointB.value;
  if (!a || !b || a === b) return log('Выберите разные точки');

  const routeKey = `${a}|${b}`;
  const route = approvedData.routes[routeKey];
  if (!route) return log('Видео не найдено');

  // Очистить плеер
  playerContainer.innerHTML = '';

  // Проверяем тип ссылки
  if (typeof route === 'string') {
    // Старый формат — .mp4 или прямая ссылка
    if (route.includes('.mp4') || route.includes('.m3u8')) {
      const video = document.createElement('video');
      video.src = route;
      video.controls = true;
      video.style.width = '100%';
      playerContainer.appendChild(video);
      video.play();
    } else if (route.includes('rutube.ru/play/embed/')) {
      // RuTube embed
      const iframe = document.createElement('iframe');
      iframe.src = route;
      iframe.width = '100%';
      iframe.height = '400';
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      playerContainer.appendChild(iframe);
    }
  } else if (route && typeof route === 'object') {
    // Новый формат: { url: "...", type: "rutube" }
    if (route.type === 'rutube') {
      const iframe = document.createElement('iframe');
      iframe.src = route.url;
      iframe.width = '100%';
      iframe.height = '400';
      iframe.frameBorder = '0';
      iframe.allowFullscreen = true;
      playerContainer.appendChild(iframe);
    } else {
      const video = document.createElement('video');
      video.src = route.url;
      video.controls = true;
      video.style.width = '100%';
      playerContainer.appendChild(video);
      video.play();
    }
  }
}
async function addLocation() {
  const name = document.getElementById('newLocationName').value.trim();
  if (!name) {
    alert('Введите название локации');
    return;
  }
  
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
    alert('Ошибка добавления локации');
  }
}

async function addRoute() {
  const from = document.getElementById('newRouteFrom').value;
  const to = document.getElementById('newRouteTo').value;
  const videoUrl = document.getElementById('newVideoUrl').value.trim();
  
  if (!from || !to) {
    alert('Выберите начальную и конечную локации');
    return;
  }
  
  if (from === to) {
    alert('Начальная и конечная локации не могут совпадать');
    return;
  }
  
  if (!videoUrl) {
    alert('Введите URL видео');
    return;
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
    alert('Ошибка добавления маршрута');
  }
}

function openAdminPanel() {
  document.getElementById('adminModal').style.display = 'flex';
  loadPendingSubmissions();
}

function closeAdminPanel() {
  document.getElementById('adminModal').style.display = 'none';
}

function openTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  document.getElementById(tabName).classList.add('active');
  event.target.classList.add('active');
  
  if (tabName === 'logsTab') {
    loadLogs();
  }
}

async function loadPendingSubmissions() {
  try {
    const res = await fetch('/api/pending-submissions', {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    });
    
    if (!res.ok) {
      throw new Error('Failed to load submissions');
    }
    
    const submissions = await res.json();
    
    const list = document.getElementById('pendingList');
    list.innerHTML = '';
    
    if (submissions.length === 0) {
      list.innerHTML = '<p>Нет ожидающих заявок</p>';
      return;
    }
    
    submissions.forEach(sub => {
      const item = document.createElement('div');
      item.className = 'submission-item';
      
      let content = '';
      if (sub.type === 'location') {
        content = `
          <strong>Локация:</strong> ${sub.data.name}<br>
          <small>От: ${sub.submittedBy} (${new Date(sub.timestamp).toLocaleString()})</small>
        `;
      } else if (sub.type === 'route') {
        content = `
          <strong>Маршрут:</strong> ${sub.data.fromLocationName} → ${sub.data.toLocationName}<br>
          <strong>Видео:</strong> ${sub.data.videoUrl}<br>
          <small>От: ${sub.submittedBy} (${new Date(sub.timestamp).toLocaleString()})</small>
        `;
      }
      
      item.innerHTML = content + `
        <div class="submission-actions">
          <button onclick="approveSubmission(${sub.id})" class="btn btn-primary">✅ Одобрить</button>
          <button onclick="rejectSubmission(${sub.id})" class="btn btn-ghost">❌ Отклонить</button>
        </div>
      `;
      
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
    
    if (!res.ok) {
      throw new Error('Failed to load logs');
    }
    
    const logs = await res.json();
    
    const list = document.getElementById('logsList');
    list.innerHTML = '';
    
    if (logs.length === 0) {
      list.innerHTML = '<p>Логи отсутствуют</p>';
      return;
    }
    
    logs.forEach(log => {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <strong>${log.action}</strong><br>
        <small>Пользователь: ${log.user} (${log.role})</small><br>
        <small>Время: ${new Date(log.timestamp).toLocaleString()}</small>
        ${log.details ? `<br><small>Детали: ${JSON.stringify(log.details)}</small>` : ''}
      `;
      list.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading logs:', error);
    alert('Ошибка загрузки логов');
  }
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
  if (!confirm('Вы уверены, что хотите отклонить эту заявку?')) return;
  
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

window.onload = () => {
  const token = localStorage.getItem('token');
  if (token) {
    currentToken = token;
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('mainInterface').style.display = 'block';
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      currentUser = { role: payload.role };
      document.getElementById('userInfo').textContent = `👤 ${payload.username} (${payload.role})`;
      
      if (payload.role === 'developer') {
        document.getElementById('adminPanelBtn').style.display = 'block';
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
    
    loadApprovedData();
  } else {
    showLogin();
  }
  
  document.getElementById('adminPanelBtn')?.addEventListener('click', openAdminPanel);
};