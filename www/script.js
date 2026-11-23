const API_BASE = "/api"; 
const MAX_CACHE_SIZE = 1024 * 1024 * 1024; // 1 ГБ в байтах

// --- НАСТРОЙКА БАЗЫ ДАННЫХ (IndexedDB) ---
let db;
const request = indexedDB.open("SoundCloudCache", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("audio")) {
        const store = db.createObjectStore("audio", { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
    }
};
request.onsuccess = (e) => { db = e.target.result; };

// --- ЭЛЕМЕНТЫ UI ---
const searchInput = document.getElementById('searchInput');
const trackList = document.getElementById('trackList');
const audioPlayer = document.getElementById('audioPlayer');
const miniPlayer = document.getElementById('miniPlayer');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniArtwork = document.getElementById('miniArtwork');
const miniPlayPause = document.getElementById('miniPlayPause');
const loadingPercent = document.getElementById('loadingPercent');
const miniPlayIcon = document.getElementById('miniPlayIcon');

const fullPlayer = document.getElementById('fullPlayer');
const fullTitle = document.getElementById('fullTitle');
const fullArtist = document.getElementById('fullArtist');
const fullArtwork = document.getElementById('fullArtwork');
const fullPlayPause = document.getElementById('fullPlayPause');
const fullPlayIcon = document.getElementById('fullPlayIcon');
const playerBg = document.getElementById('playerBg');
const seekBar = document.getElementById('seekBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const closePlayerBtn = document.getElementById('closePlayer');

const ICON_PLAY = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
const ICON_PAUSE = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';

function setPlayIcon(isPlaying) {
    const icon = isPlaying ? ICON_PAUSE : ICON_PLAY;
    miniPlayIcon.innerHTML = icon;
    fullPlayIcon.innerHTML = icon;
}

// --- УПРАВЛЕНИЕ КЭШЕМ ---
async function getCacheSize() {
    return new Promise((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const store = tx.objectStore("audio");
        const req = store.getAll();
        req.onsuccess = () => {
            const total = req.result.reduce((acc, item) => acc + item.size, 0);
            resolve(total);
        };
    });
}

async function saveToCache(id, blob) {
    let currentSize = await getCacheSize();
    
    // Если места нет, удаляем старые
    if (currentSize + blob.size > MAX_CACHE_SIZE) {
        const tx = db.transaction("audio", "readwrite");
        const store = tx.objectStore("audio");
        const index = store.index("timestamp");
        // Получаем самые старые треки
        const req = index.openCursor();
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
                currentSize -= cursor.value.size;
                cursor.delete(); // Удаляем
                if (currentSize + blob.size <= MAX_CACHE_SIZE) return; // Хватит места
                cursor.continue();
            }
        };
    }

    // Сохраняем новый
    const tx = db.transaction("audio", "readwrite");
    const store = tx.objectStore("audio");
    store.put({ id: id, blob: blob, size: blob.size, timestamp: Date.now() });
}

async function getFromCache(id) {
    return new Promise((resolve) => {
        const tx = db.transaction("audio", "readonly");
        const store = tx.objectStore("audio");
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result ? req.result.blob : null);
    });
}

// --- ПОИСК ---
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    searchInput.blur(); 
    trackList.innerHTML = '<div style="text-align:center; padding: 20px;">Ищем...</div>';
    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        renderTracks(data.collection);
    } catch (error) {
        trackList.innerHTML = '<div style="color: red; text-align:center;">Ошибка сети</div>';
    }
}

function renderTracks(tracks) {
    trackList.innerHTML = '';
    if (!tracks) return;
    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'track-item';
        const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large', '-t200x200') : 'https://via.placeholder.com/56/282828/FFFFFF?text=🎵';
        item.innerHTML = `
            <img class="track-artwork" src="${artworkUrl}">
            <div class="track-info"><div class="track-title">${track.title}</div><div class="track-artist">${track.user}</div></div>
        `;
        item.addEventListener('click', () => playTrack(track, artworkUrl));
        trackList.appendChild(item);
    });
}

// --- ВОСПРОИЗВЕДЕНИЕ И ЗАГРУЗКА ---
let currentTrackId = null;
let currentBlobUrl = null;

async function playTrack(track, artworkUrl) {
    currentTrackId = track.id;
    
    // Обновляем UI
    miniPlayer.classList.remove('hidden');
    miniTitle.textContent = track.title;
    miniArtist.textContent = track.user;
    miniArtwork.src = artworkUrl;
    fullTitle.textContent = track.title;
    fullArtist.textContent = track.user;
    fullArtwork.src = artworkUrl;
    playerBg.style.backgroundImage = `url(${artworkUrl})`;

    miniPlayer.classList.add('loading');
    loadingPercent.textContent = '0%';
    setPlayIcon(false);
    
    // Если играет другая музыка — останавливаем
    audioPlayer.pause();
    if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }

    // 1. ПРОВЕРЯЕМ КЭШ ТЕЛЕФОНА
    const cachedBlob = await getFromCache(track.id);
    if (cachedBlob) {
        console.log("Играем из кэша!");
        currentBlobUrl = URL.createObjectURL(cachedBlob);
        audioPlayer.src = currentBlobUrl;
        miniPlayer.classList.remove('loading');
        audioPlayer.play();
        return;
    }

    // 2. ЕСЛИ В КЭШЕ НЕТ — КАЧАЕМ
    try {
        const response = await fetch(`${API_BASE}/stream/${track.id}`);
        const data = await response.json();
        
        if (!data.url) throw new Error("Нет ссылки на аудио");

        if (data.type === "mp3") {
            // Скачиваем с отображением процентов
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
                const percent = Math.round((receivedLength / contentLength) * 100);
                loadingPercent.textContent = percent + '%';
            }

            const blob = new Blob(chunks, {type: 'audio/mpeg'});
            await saveToCache(track.id, blob);
            
            currentBlobUrl = URL.createObjectURL(blob);
            audioPlayer.src = currentBlobUrl;
            miniPlayer.classList.remove('loading');
            audioPlayer.play();
        } else {
            // Если это HLS-поток, мы не можем скачать его целиком как 1 файл, 
            // поэтому просто стримим (он играет без 30-сек ограничений)
            audioPlayer.src = data.url;
            audioPlayer.play();
            miniPlayer.classList.remove('loading');
        }
        
    } catch (error) {
        console.error(error);
        loadingPercent.textContent = 'ОШИБКА';
    }
}

// --- ОБРАБОТЧИКИ КНОПОК И ВРЕМЕНИ ---
function togglePlay() {
    if (!audioPlayer.src) return;
    if (audioPlayer.paused) { audioPlayer.play(); setPlayIcon(true); } 
    else { audioPlayer.pause(); setPlayIcon(false); }
}
miniPlayPause.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
fullPlayPause.addEventListener('click', togglePlay);
miniPlayer.addEventListener('click', () => fullPlayer.classList.add('active'));
closePlayerBtn.addEventListener('click', () => fullPlayer.classList.remove('active'));

audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    seekBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    
    const curM = Math.floor(audioPlayer.currentTime / 60);
    const curS = Math.floor(audioPlayer.currentTime % 60);
    currentTimeEl.textContent = `${curM}:${curS < 10 ? '0' : ''}${curS}`;
    
    const rem = audioPlayer.duration - audioPlayer.currentTime;
    const remM = Math.floor(rem / 60);
    const remS = Math.floor(rem % 60);
    totalTimeEl.textContent = `-${remM}:${remS < 10 ? '0' : ''}${remS}`;
});

seekBar.addEventListener('input', () => {
    if (audioPlayer.duration) audioPlayer.currentTime = (seekBar.value / 100) * audioPlayer.duration;
});

audioPlayer.addEventListener('ended', () => setPlayIcon(false));
