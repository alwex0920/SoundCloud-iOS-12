// В самом верху файла
const API_BASE = "/api"; 
const searchInput = document.getElementById('searchInput');
const trackList = document.getElementById('trackList');
const audioPlayer = document.getElementById('audioPlayer');

// Элементы мини-плеера
const miniPlayer = document.getElementById('miniPlayer');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniArtwork = document.getElementById('miniArtwork');
const miniPlayPause = document.getElementById('miniPlayPause');
const loadingPercent = document.getElementById('loadingPercent');

// Элементы большого плеера
const fullPlayer = document.getElementById('fullPlayer');
const fullTitle = document.getElementById('fullTitle');
const fullArtist = document.getElementById('fullArtist');
const fullArtwork = document.getElementById('fullArtwork');
const fullPlayPause = document.getElementById('fullPlayPause');
const playerBg = document.getElementById('playerBg');
const seekBar = document.getElementById('seekBar');
const currentTimeEl = document.getElementById('currentTime');
const totalTimeEl = document.getElementById('totalTime');
const closePlayerBtn = document.getElementById('closePlayer');

function showError(message) {
    const consoleEl = document.getElementById('errorConsole');
    document.getElementById('errorText').innerText = message;
    consoleEl.style.display = 'block';
}
window.onerror = function(m, s, l, c, e) { showError(m + " (Line: " + l + ")"); return false; };

// ПОИСК
searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); performSearch(); }
});

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
        showError(`Ошибка сети: ${error.message}`);
        trackList.innerHTML = '<div style="color: red; text-align:center;">Ошибка загрузки</div>';
    }
}

function renderTracks(tracks) {
    trackList.innerHTML = '';
    if (!tracks || tracks.length === 0) return;
    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'track-item';
        const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large', '-t200x200') : 'https://via.placeholder.com/56/282828/FFFFFF?text=🎵';
        item.innerHTML = `
            <img class="track-artwork" src="${artworkUrl}">
            <div class="track-info">
                <div class="track-title">${track.title}</div>
                <div class="track-artist">${track.user}</div>
            </div>
        `;
        item.addEventListener('click', () => playTrack(track, artworkUrl));
        trackList.appendChild(item);
    });
}

// ВОСПРОИЗВЕДЕНИЕ И ЗАГРУЗКА
let currentTrack = null;

async function playTrack(track, artworkUrl) {
    currentTrack = track;
    
    // Обновляем UI
    miniPlayer.classList.remove('hidden');
    miniTitle.textContent = track.title;
    miniArtist.textContent = track.user;
    miniArtwork.src = artworkUrl;
    
    fullTitle.textContent = track.title;
    fullArtist.textContent = track.user;
    fullArtwork.src = artworkUrl;
    playerBg.style.backgroundImage = `url(${artworkUrl})`;

    // Включаем режим загрузки
    miniPlayer.classList.add('loading');
    loadingPercent.textContent = '0%';
    miniPlayPause.textContent = '⏳';
    
    try {
        const response = await fetch(`${API_BASE}/stream/${track.id}`);
        const data = await response.json();
        
        if (data.url) {
            audioPlayer.src = data.url;
            audioPlayer.load();
            // Пытаемся играть (загрузка пойдет в фоне)
            audioPlayer.play().catch(e => console.log("Autoplay prevented:", e));
        }
    } catch (error) {
        showError("Ошибка стриминга: " + error.message);
    }
}

// Отслеживаем прогресс загрузки (буферизацию)
audioPlayer.addEventListener('progress', () => {
    if (audioPlayer.buffered.length > 0 && audioPlayer.duration) {
        const bufferedEnd = audioPlayer.buffered.end(audioPlayer.buffered.length - 1);
        const percent = Math.round((bufferedEnd / audioPlayer.duration) * 100);
        loadingPercent.textContent = percent + '%';
        
        // Если загрузилось больше 10% или полностью, можно разрешить играть
        if (percent > 10) {
            miniPlayer.classList.remove('loading');
            miniPlayPause.textContent = audioPlayer.paused ? '▶️' : '⏸';
        }
    }
});

audioPlayer.addEventListener('canplay', () => {
    miniPlayer.classList.remove('loading');
    miniPlayPause.textContent = '⏸';
    fullPlayPause.textContent = '⏸';
});

audioPlayer.addEventListener('waiting', () => {
    miniPlayer.classList.add('loading');
    miniPlayPause.textContent = '⏳';
});

// Синхронизация кнопок Play/Pause
function togglePlay() {
    if (audioPlayer.paused) {
        audioPlayer.play();
        miniPlayPause.textContent = '⏸';
        fullPlayPause.textContent = '⏸';
    } else {
        audioPlayer.pause();
        miniPlayPause.textContent = '▶️';
        fullPlayPause.textContent = '▶️';
    }
}
miniPlayPause.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
fullPlayPause.addEventListener('click', togglePlay);

// Открытие/закрытие большого плеера
miniPlayer.addEventListener('click', () => fullPlayer.classList.add('active'));
closePlayerBtn.addEventListener('click', () => fullPlayer.classList.remove('active'));

// Синхронизация времени и ползунка
audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    
    // Обновляем ползунок
    seekBar.value = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    
    // Обновляем время
    const curMins = Math.floor(audioPlayer.currentTime / 60);
    const curSecs = Math.floor(audioPlayer.currentTime % 60);
    currentTimeEl.textContent = `${curMins}:${curSecs < 10 ? '0' : ''}${curSecs}`;
    
    const remTime = audioPlayer.duration - audioPlayer.currentTime;
    const remMins = Math.floor(remTime / 60);
    const remSecs = Math.floor(remTime % 60);
    totalTimeEl.textContent = `-${remMins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
});

// Перемотка через ползунок
seekBar.addEventListener('input', () => {
    if (audioPlayer.duration) {
        audioPlayer.currentTime = (seekBar.value / 100) * audioPlayer.duration;
    }
});

audioPlayer.addEventListener('ended', () => {
    miniPlayPause.textContent = '▶️';
    fullPlayPause.textContent = '▶️';
});
