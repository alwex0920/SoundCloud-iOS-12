const API_BASE = "/api"; 
const MAX_CACHE_SIZE = 1024 * 1024 * 1024; // 1 ГБ

let authToken = localStorage.getItem('sc_oauth_token');
let playQueue = [];
let currentIndex = -1;
let currentBlobUrl = null;

// --- БАЗА ДАННЫХ ДЛЯ КЭША ---
let db;
const dbRequest = indexedDB.open("SoundCloudCache", 1);
dbRequest.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("audio")) {
        const store = db.createObjectStore("audio", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
    }
};
dbRequest.onsuccess = (e) => { db = e.target.result; };

// --- ИНИЦИАЛИЗАЦИЯ И ВХОД ---
window.onload = () => {
    if (!authToken) {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').classList.add('hidden');
    } else {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').classList.remove('hidden');
    }
};

document.getElementById('loginBtn').addEventListener('click', () => {
    if (window.webkit && window.webkit.messageHandlers.loginHandler) {
        window.webkit.messageHandlers.loginHandler.postMessage("open");
    } else {
        alert("Вход доступен только в iOS приложении");
    }
});

// Эту функцию вызывает Swift, когда перехватывает токен
window.saveToken = function(token) {
    authToken = token;
    localStorage.setItem('sc_oauth_token', token);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.remove('hidden');
};

function getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `OAuth ${authToken}`;
    return headers;
}

// --- УПРАВЛЕНИЕ КЭШЕМ ---
async function getCacheSize() {
    return new Promise((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const req = tx.objectStore("audio").getAll();
        req.onsuccess = () => resolve(req.result.reduce((acc, item) => acc + item.size, 0));
    });
}

async function saveToCache(id, blob) {
    let currentSize = await getCacheSize();
    if (currentSize + blob.size > MAX_CACHE_SIZE) {
        const tx = db.transaction("audio", "readwrite");
        const index = tx.objectStore("audio").index("timestamp");
        index.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                currentSize -= cursor.value.size;
                cursor.delete();
                if (currentSize + blob.size <= MAX_CACHE_SIZE) return;
                cursor.continue();
            }
        };
    }
    const tx = db.transaction("audio", "readwrite");
    tx.objectStore("audio").put({ id: id, blob: blob, size: blob.size, timestamp: Date.now() });
}

async function getFromCache(id) {
    return new Promise((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const req = tx.objectStore("audio").get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    });
}

// --- ВКЛАДКИ (Навигация) ---
document.getElementById('navSearch').addEventListener('click', () => {
    document.getElementById('navProfile').classList.remove('active');
    document.getElementById('navSearch').classList.add('active');
    document.getElementById('searchContainer').style.display = 'block';
    document.getElementById('pageTitle').innerHTML = "Что слушаем<br>сегодня?";
    document.getElementById('pageSubtitle').innerText = "ПОИСК · ЛИНЗА";
    document.getElementById('trackList').innerHTML = '';
});

document.getElementById('navProfile').addEventListener('click', async () => {
    document.getElementById('navSearch').classList.remove('active');
    document.getElementById('navProfile').classList.add('active');
    document.getElementById('searchContainer').style.display = 'none';
    document.getElementById('pageTitle').innerHTML = "Твоя<br>музыка";
    document.getElementById('pageSubtitle').innerText = "БИБЛИОТЕКА";
    
    const list = document.getElementById('trackList');
    list.innerHTML = '<div style="text-align:center; padding: 20px;">Загружаем...</div>';
    
    try {
        const res = await fetch(`${API_BASE}/me/likes`, { headers: getHeaders() });
        if (res.status === 401) {
            alert("Сессия истекла, войдите заново.");
            localStorage.removeItem('sc_oauth_token');
            location.reload();
            return;
        }
        const data = await res.json();
        renderTracks(data.collection, "Твои лайки");
    } catch (e) {
        list.innerHTML = '<div style="text-align:center; color:red;">Ошибка загрузки</div>';
    }
});

// --- ПОИСК ---
document.getElementById('searchInput').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (!q) return;
        e.target.blur();
        document.getElementById('trackList').innerHTML = '<div style="text-align:center; padding: 20px;">Ищем...</div>';
        
        try {
            const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { headers: getHeaders() });
            const data = await res.json();
            renderTracks(data.collection);
        } catch (e) {
            document.getElementById('trackList').innerHTML = '<div style="text-align:center; color:red;">Ошибка сети</div>';
        }
    }
});

// --- РЕНДЕР СПИСКА И ОЧЕРЕДЬ ---
function renderTracks(tracks, title = "") {
    const list = document.getElementById('trackList');
    list.innerHTML = title ? `<h3 style="margin: 15px; font-size:18px;">${title}</h3>` : '';
    if (!tracks || tracks.length === 0) {
        list.innerHTML += '<div style="text-align:center; padding: 20px;">Пусто</div>';
        return;
    }
    
    playQueue = tracks; // Сохраняем текущий список как очередь
    
    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-item';
        const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large', '-t200x200') : 'https://via.placeholder.com/56/282828/FFFFFF?text=🎵';
        item.innerHTML = `
            <img class="track-artwork" src="${artworkUrl}">
            <div class="track-info"><div class="track-title">${track.title}</div><div class="track-artist">${track.user}</div></div>
        `;
        item.addEventListener('click', () => {
            currentIndex = index; // Запоминаем, какой по счету трек включили
            playTrack(track, artworkUrl);
        });
        list.appendChild(item);
    });
}

// --- ПЛЕЕР ---
const ICON_PLAY = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
const ICON_PAUSE = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
const audioPlayer = document.getElementById('audioPlayer');
const miniPlayer = document.getElementById('miniPlayer');
const fullPlayer = document.getElementById('fullPlayer');

function setPlayIcon(isPlaying) {
    const icon = isPlaying ? ICON_PAUSE : ICON_PLAY;
    document.getElementById('miniPlayIcon').innerHTML = icon;
    document.getElementById('fullPlayIcon').innerHTML = icon;
}

async function playTrack(track, artworkUrl) {
    document.getElementById('miniTitle').textContent = track.title;
    document.getElementById('miniArtist').textContent = track.user;
    document.getElementById('miniArtwork').src = artworkUrl;
    
    document.getElementById('fullTitle').textContent = track.title;
    document.getElementById('fullArtist').textContent = track.user;
    document.getElementById('fullArtwork').src = artworkUrl;
    document.getElementById('playerBg').style.backgroundImage = `url(${artworkUrl})`;

    miniPlayer.classList.remove('hidden');
    miniPlayer.classList.add('loading');
    document.getElementById('loadingPercent').textContent = '0%';
    setPlayIcon(false);
    
    audioPlayer.pause();
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }

    // 1. Проверяем кэш
    const cachedBlob = await getFromCache(track.id);
    if (cachedBlob) {
        currentBlobUrl = URL.createObjectURL(cachedBlob);
        audioPlayer.src = currentBlobUrl;
        miniPlayer.classList.remove('loading');
        audioPlayer.play();
        setPlayIcon(true);
        return;
    }

    // 2. Если нет в кэше — качаем
    try {
        const response = await fetch(`${API_BASE}/stream/${track.id}`);
        const data = await response.json();
        
        if (!data.url) throw new Error("Нет ссылки");

        if (data.type === "mp3") {
            const audioResponse = await fetch(data.url);
            const reader = audioResponse.body.getReader();
            const contentLength = +audioResponse.headers.get('Content-Length');
            let receivedLength = 0;
            let chunks = [];

            while(true) {
                const {done, value} = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;
                document.getElementById('loadingPercent').textContent = Math.round((receivedLength / contentLength) * 100) + '%';
            }

            const blob = new Blob(chunks, {type: 'audio/mpeg'});
            await saveToCache(track.id, blob);
            
            currentBlobUrl = URL.createObjectURL(blob);
            audioPlayer.src = currentBlobUrl;
            miniPlayer.classList.remove('loading');
            audioPlayer.play();
            setPlayIcon(true);
        } else {
            audioPlayer.src = data.url;
            miniPlayer.classList.remove('loading');
            audioPlayer.play();
            setPlayIcon(true);
        }
    } catch (error) {
        document.getElementById('loadingPercent').textContent = 'ERR';
        console.error(error);
    }
}

// Кнопки Play/Pause
document.getElementById('miniPlayPause').addEventListener('click', (e) => {
    e.stopPropagation();
    if (audioPlayer.paused) { audioPlayer.play(); setPlayIcon(true); }
    else { audioPlayer.pause(); setPlayIcon(false); }
});
document.getElementById('fullPlayPause').addEventListener('click', () => {
    if (audioPlayer.paused) { audioPlayer.play(); setPlayIcon(true); }
    else { audioPlayer.pause(); setPlayIcon(false); }
});

// Открытие/закрытие плеера
miniPlayer.addEventListener('click', () => fullPlayer.classList.add('active'));
document.getElementById('closePlayer').addEventListener('click', () => fullPlayer.classList.remove('active'));

// Очередь (Next / Prev)
document.getElementById('nextBtn').addEventListener('click', () => {
    if (playQueue.length === 0) return;
    currentIndex = (currentIndex + 1) % playQueue.length;
    const t = playQueue[currentIndex];
    playTrack(t, t.artwork_url ? t.artwork_url.replace('-large', '-t200x200') : '');
});
document.getElementById('prevBtn').addEventListener('click', () => {
    if (playQueue.length === 0) return;
    currentIndex = (currentIndex - 1 + playQueue.length) % playQueue.length;
    const t = playQueue[currentIndex];
    playTrack(t, t.artwork_url ? t.artwork_url.replace('-large', '-t200x200') : '');
});

// Таймлайн
audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    document.getElementById('seekBar').value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.getElementById('currentTime').textContent = `${Math.floor(audioPlayer.currentTime/60)}:${Math.floor(audioPlayer.currentTime%60).toString().padStart(2,'0')}`;
    const rem = audioPlayer.duration - audioPlayer.currentTime;
    document.getElementById('totalTime').textContent = `-${Math.floor(rem/60)}:${Math.floor(rem%60).toString().padStart(2,'0')}`;
});

document.getElementById('seekBar').addEventListener('input', () => {
    if (audioPlayer.duration) audioPlayer.currentTime = (document.getElementById('seekBar').value / 100) * audioPlayer.duration;
});

audioPlayer.addEventListener('ended', () => {
    document.getElementById('nextBtn').click(); // Автоматически включаем следующий
});
