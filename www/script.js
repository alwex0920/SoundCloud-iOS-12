// Функция для вывода ошибок на экран
function showError(message) {
    console.error(message);
    const errorConsole = document.getElementById('errorConsole');
    const errorText = document.getElementById('errorText');
    
    if (errorConsole && errorText) {
        errorText.innerText += message + "\n";
        errorConsole.style.display = 'block';
    } else {
        alert("Критическая ошибка JS: " + message);
    }
}

// Перехватываем все ошибки JavaScript
window.onerror = function(message, source, lineno, colno, error) {
    showError(`JS Error: ${message} (Line: ${lineno})`);
    return false;
};

// ВАЖНО: Используем HTTP, если HTTPS с самоподписанным сертификатом блокируется
// Попробуй http://, если сейчас стоит https://
const API_BASE = "/api"; 
const searchInput = document.getElementById('searchInput');
const trackList = document.getElementById('trackList');
const player = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');

searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
    }
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchInput.blur(); 
    trackList.innerHTML = '<div class="loading-text">Ищем треки...</div>';

    try {
        const url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
        console.log("Отправка запроса на:", url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            showError(`Ошибка от сервера: ${data.error}`);
            trackList.innerHTML = `<div class="loading-text" style="color: #ff5555;">Ошибка сервера</div>`;
            return;
        }
        
        renderTracks(data.collection);
    } catch (error) {
        // ВЫВОДИМ ОШИБКУ НА ЭКРАН
        showError(`Ошибка сети: ${error.message}. Проверь, доступен ли сервер ${API_BASE}`);
        trackList.innerHTML = '<div class="loading-text" style="color: #ff5555;">Ошибка загрузки данных.<br>Смотри красный баннер сверху.</div>';
    }
}

function renderTracks(tracks) {
    trackList.innerHTML = '';
    if (!tracks || tracks.length === 0) {
        trackList.innerHTML = '<div class="loading-text">Ничего не найдено</div>';
        return;
    }

    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'track-item';
        
        // Меняем размер обложки на маленький для быстрой загрузки
        const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large', '-t200x200') : '';
        
        item.innerHTML = `
            <img class="track-artwork" src="${artworkUrl}" onerror="this.src='https://via.placeholder.com/56/282828/FFFFFF?text=🎵'">
            <div class="track-info">
                <div class="track-title">${track.title}</div>
                <div class="track-artist">${track.user}</div>
            </div>
        `;
        
        item.addEventListener('click', () => playTrack(track, artworkUrl));
        trackList.appendChild(item);
    });
}

async function playTrack(track, artworkUrl) {
    player.classList.remove('hidden');
    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.user;
    
    if (artworkUrl) {
        document.getElementById('playerArtwork').src = artworkUrl;
    }

    try {
        const response = await fetch(`${API_BASE}/stream/${track.id}`);
        const data = await response.json();
        
        if (data.url) {
            audioPlayer.src = data.url;
            audioPlayer.play().then(() => {
                playPauseBtn.textContent = '⏸';
            }).catch(e => console.log("Ошибка автовоспроизведения:", e));
        }
    } catch (error) {
        console.error("Ошибка стриминга:", error);
    }
}

playPauseBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play();
        playPauseBtn.textContent = '⏸';
    } else {
        audioPlayer.pause();
        playPauseBtn.textContent = '▶️';
    }
});

audioPlayer.addEventListener('ended', () => {
    playPauseBtn.textContent = '▶️';
});
