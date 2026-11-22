const API_BASE = "https://95.81.95.42/api"; // Твой IP сервера
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const trackList = document.getElementById('trackList');
const player = document.getElementById('player');
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');

// Обработка поиска
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) return;

    searchInput.blur(); // Скрываем клавиатуру
    trackList.innerHTML = '<div style="text-align:center; padding: 20px;">Загрузка...</div>';

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        renderTracks(data.collection);
    } catch (error) {
        console.error(error);
        trackList.innerHTML = '<div style="text-align:center; color: red;">Ошибка загрузки</div>';
    }
});

function renderTracks(tracks) {
    trackList.innerHTML = '';
    if (!tracks || tracks.length === 0) {
        trackList.innerHTML = '<div style="text-align:center; padding: 20px;">Ничего не найдено</div>';
        return;
    }

    tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'track-item';
        
        // Заглушка, если нет обложки
        const artworkUrl = track.artwork_url ? track.artwork_url.replace('-large', '-t50x50') : '';
        
        item.innerHTML = `
            <img class="track-artwork" src="${artworkUrl}" onerror="this.src='https://via.placeholder.com/50/282828/FFFFFF?text=🎵'">
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
    // Показываем плеер
    player.classList.remove('hidden');
    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.user;
    document.getElementById('playerArtwork').src = artworkUrl;
    
    // Получаем ссылку на стрим с нашего сервера
    try {
        const response = await fetch(`${API_BASE}/stream/${track.id}`);
        const data = await response.json();
        
        if (data.url) {
            audioPlayer.src = data.url;
            audioPlayer.play();
            playPauseBtn.textContent = '⏸';
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

// Автоматически переключать иконку, если трек закончился
audioPlayer.addEventListener('ended', () => {
    playPauseBtn.textContent = '▶️';
});
