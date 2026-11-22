// ВАЖНО: Используем IP твоего сервера. 
// Если у тебя настроен HTTPS с самоподписанным сертификатом, iOS может блокировать запросы.
const API_BASE = "https://95.81.95.42/api"; 
const searchInput = document.getElementById('searchInput');
const trackList = document.getElementById('trackList');
const player = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');

// Поиск по нажатию на Enter
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
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.error) {
            trackList.innerHTML = `<div class="loading-text" style="color: #ff5555;">Ошибка сервера: ${data.error}</div>`;
            return;
        }
        
        renderTracks(data.collection);
    } catch (error) {
        console.error(error);
        // Если fetch падает, скорее всего это проблема с сертификатом HTTPS
        trackList.innerHTML = '<div class="loading-text" style="color: #ff5555;">Ошибка сети. Проверь сервер.</div>';
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
