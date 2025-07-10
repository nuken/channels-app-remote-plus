const clientSelect = document.getElementById('client-select');
const dvrServerSelect = document.getElementById('dvr-server-select');
const channelSelect = document.getElementById('channel-select');
const enablePopupsCheckbox = document.getElementById('enablePopups');
const notificationArea = document.getElementById('notification-area');
const statusDisplay = document.getElementById('status-display');
const nowPlayingDisplay = document.getElementById('now-playing-display');
const controlButtons = document.querySelectorAll('.control-button');
const themeSelect = document.getElementById('theme-select');
const dvrServerIpDisplay = document.getElementById('dvr-server-ip-display');
const moviesListDiv = document.getElementById('movies-list');
const episodesListDiv = document.getElementById('episodes-list');

// New elements for search and sort
const moviesSearchInput = document.getElementById('movies-search');
const moviesSortBySelect = document.getElementById('movies-sort-by');
const moviesSortOrderSelect = document.getElementById('movies-sort-order');

const showsSearchInput = document.getElementById('shows-search');
const showsSortBySelect = document.getElementById('shows-sort-by');
const showsSortOrderSelect = document.getElementById('shows-sort-order');

let selectedClientIp = '';
let selectedDvrServerIp = '';
let selectedDvrServerPort = '';
let autoScrollInterval;
let allMoviesData = [];
let allEpisodesData = [];

function showNotification(message, isError = false) {
    if (!enablePopupsCheckbox.checked) {
        console.log("Notification suppressed:", message);
        return;
    }
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : ''}`;
    notification.textContent = message;
    notificationArea.appendChild(notification);

    void notification.offsetWidth;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => notification.remove(), { once: true });
    }, 3000);
}

function toggleControls(enable) {
    controlButtons.forEach(button => {
        button.disabled = !enable;
    });
    if (enable && selectedClientIp) {
        channelSelect.disabled = false;
    } else {
        channelSelect.disabled = true;
    }
}

function applyTheme() {
    const selectedTheme = themeSelect.value;
    console.log("applyTheme function called. Selected theme:", selectedTheme);

    document.documentElement.className = '';

    if (selectedTheme !== 'default-light') {
        document.documentElement.classList.add(`theme-${selectedTheme}`);
        console.log(`applyTheme: Applied theme-${selectedTheme} to <html>.`);
    } else {
        console.log("applyTheme: Reverting to default-light theme (no class added to <html>).");
    }
    localStorage.setItem('selectedTheme', selectedTheme);
    console.log("applyTheme: Saved selectedTheme to localStorage:", selectedTheme);
}

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'default-light';
    console.log("DOMContentLoaded: Initial savedTheme from localStorage:", savedTheme);
    themeSelect.value = savedTheme;
    console.log("DOMContentLoaded: Set themeSelect dropdown value to:", themeSelect.value);

    const savedPopupState = localStorage.getItem('enablePopups');
    if (savedPopupState !== null) {
        enablePopupsCheckbox.checked = JSON.parse(savedPopupState);
    } else {
        enablePopupsCheckbox.checked = false;
    }

    enablePopupsCheckbox.addEventListener('change', () => {
        localStorage.setItem('enablePopups', enablePopupsCheckbox.checked);
    });

    // Load last selected DVR server IP:Port first, as it's needed for client discovery
    const lastSelectedDvrServerIpPort = localStorage.getItem('lastSelectedDvrServerIpPort');
    let foundLastDvrServer = false;
    if (lastSelectedDvrServerIpPort) {
        const dvrServerOption = Array.from(dvrServerSelect.options).find(option => option.value === lastSelectedDvrServerIpPort);
        if (dvrServerOption) {
            dvrServerSelect.value = lastSelectedDvrServerIpPort;
            await selectDvrServer(); // Await this as it loads clients
            foundLastDvrServer = true;
        }
    }

    if (!foundLastDvrServer && flaskDvrServers.length > 0) {
        const firstDvrServerValue = `${flaskDvrServers[0].ip}:${flaskDvrServers[0].port}`;
        const dvrServerOption = Array.from(dvrServerSelect.options).find(option => option.value === firstDvrServerValue);
        if (dvrServerOption) {
            dvrServerSelect.value = firstDvrServerValue;
            await selectDvrServer(); // Await this
        }
    } else if (flaskDvrServers.length === 0) {
        dvrServerSelect.disabled = true;
        showNotification("No DVR servers configured.", true);
    }

    // Load last selected client IP after DVR server (and thus client list) is loaded
    const lastSelectedClientIp = localStorage.getItem('lastSelectedClientIp');
    let foundLastClient = false;
    if (lastSelectedClientIp) {
        // Find in the dynamically populated clientSelect options
        const clientOption = Array.from(clientSelect.options).find(option => option.value === lastSelectedClientIp);
        if (clientOption) {
            clientSelect.value = lastSelectedClientIp;
            await selectClient();
            foundLastClient = true;
        }
    }
    // If no last client found or clients_configured is false (meaning initial discovery failed)
    // and there are still clients in the dropdown (from dynamic load via first DVR server)
    if (!foundLastClient && clientSelect.options.length > 1) { // >1 because of "Select a Client" option
        clientSelect.selectedIndex = 1; // Select the first actual client
        await selectClient();
    } else if (clientSelect.options.length <= 1) { // No clients beyond the placeholder
        toggleControls(false);
        statusDisplay.innerText = "No Channels App clients configured/discovered. Please ensure a DVR server is selected and reachable.";
        nowPlayingDisplay.classList.add('hidden');
        showNotification("No Channels App clients configured/discovered.", true);
    }


    setupCarouselNavigation();

    moviesSearchInput.addEventListener('input', debounce(filterAndRenderMovies, 300));
    moviesSortBySelect.addEventListener('change', filterAndRenderMovies);
    moviesSortOrderSelect.addEventListener('change', filterAndRenderMovies);

    showsSearchInput.addEventListener('input', debounce(filterAndRenderShows, 300));
    showsSortBySelect.addEventListener('change', filterAndRenderShows);
    showsSortOrderSelect.addEventListener('change', filterAndRenderShows);
});

async function selectClient() {
    selectedClientIp = clientSelect.value;
    if (selectedClientIp) {
        localStorage.setItem('lastSelectedClientIp', selectedClientIp);
        showNotification(`Controlling: ${clientSelect.options[clientSelect.selectedIndex].text}`, false);
        toggleControls(true);
        getStatus();
        loadChannels();
    } else {
        localStorage.removeItem('lastSelectedClientIp');
        showNotification("Please select a client device.", true);
        toggleControls(false);
        statusDisplay.innerText = "Select a client and click \"Refresh Status\" to fetch.";
        nowPlayingDisplay.classList.add('hidden');
        channelSelect.innerHTML = '<option value="">Select a Client First</option>';
    }
}

// MODIFIED: This function now dynamically loads clients for the selected DVR server
async function selectDvrServer() {
    const selectedValue = dvrServerSelect.value;
    if (selectedValue) {
        const [ip, port] = selectedValue.split(':');
        selectedDvrServerIp = ip; 
        selectedDvrServerPort = port;
        localStorage.setItem('lastSelectedDvrServerIpPort', selectedValue);
        dvrServerIpDisplay.textContent = `Selected: ${selectedValue}`;
        dvrServerIpDisplay.style.display = 'inline';
        showNotification(`DVR Server selected: ${selectedValue}`, false);
        
        // --- NEW: Fetch and populate clients for the selected DVR server ---
        await fetchClientsForDvrServer(selectedDvrServerIp, selectedDvrServerPort);

        loadMovies();
        loadShows();
    } else {
        localStorage.removeItem('lastSelectedDvrServerIpPort');
        dvrServerIpDisplay.textContent = 'Not Selected';
        dvrServerIpDisplay.style.display = 'none';
        moviesListDiv.innerHTML = '<p>Please select a DVR server.</p>';
        episodesListDiv.innerHTML = '<p>Please select a DVR server.</p>';
        showNotification("Please select a DVR server.", true);
        allMoviesData = [];
        allEpisodesData = [];

        // Clear and disable client select if no DVR server is selected
        clientSelect.innerHTML = '<option value="">Select a Client</option>';
        clientSelect.disabled = true;
        selectedClientIp = ''; // Reset selected client
        localStorage.removeItem('lastSelectedClientIp');
        toggleControls(false); // Disable controls as no client is selected
        statusDisplay.innerText = "No DVR server selected.";
        nowPlayingDisplay.classList.add('hidden');
    }
}

// NEW FUNCTION: To fetch clients for a specific DVR server
async function fetchClientsForDvrServer(dvrIp, dvrPort) {
    clientSelect.innerHTML = '<option value="">Loading Clients...</option>';
    clientSelect.disabled = true;
    selectedClientIp = ''; // Clear previously selected client
    localStorage.removeItem('lastSelectedClientIp');
    toggleControls(false); // Disable controls while clients are loading

    try {
        const response = await fetch(`/dvr_clients?dvr_server_ip=${dvrIp}&dvr_server_port=${dvrPort}`);
        const result = await response.json();

        clientSelect.innerHTML = '<option value="">Select a Client</option>'; // Reset dropdown

        if (result.status === 'error') {
            showNotification(`Failed to load clients: ${result.message}`, true);
            clientSelect.innerHTML = `<option value="">Error: ${result.message}</option>`;
            clientSelect.disabled = true;
        } else if (result.clients && result.clients.length > 0) {
            result.clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.ip;
                option.textContent = `${client.name} (${client.ip})`;
                clientSelect.appendChild(option);
            });
            clientSelect.disabled = false;
            showNotification(`Loaded ${result.clients.length} clients for ${dvrIp}:${dvrPort}.`, false);

            // Auto-select the first client if available after loading
            clientSelect.selectedIndex = 1;
            await selectClient();
        } else {
            showNotification(`No eligible clients found for ${dvrIp}:${dvrPort}.`, false);
            clientSelect.innerHTML = '<option value="">No Clients Found</option>';
            clientSelect.disabled = true;
        }
    } catch (error) {
        showNotification(`Error fetching clients for DVR server ${dvrIp}:${dvrPort}: ${error.message}`, true);
        clientSelect.innerHTML = '<option value="">Failed to load clients.</option>';
        clientSelect.disabled = true;
        console.error("Error fetching clients:", error);
    }
}


async function sendCommand(action, value = null, recordingId = null) {
    if (!selectedClientIp) {
        showNotification("Please select a Channels App client first.", true);
        return 'error';
    }

    const data = { action: action, device_ip: selectedClientIp };
    if (value !== null) {
        data.value = value;
    }
    if (recordingId !== null) {
        data.recording_id = recordingId;
    }

    try {
        const response = await fetch('/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        showNotification(`Action '${action}': ${result.message}`, result.status === 'error');
        getStatus();
        return result.status;
    } catch (error) {
        showNotification(`Error sending command: ${error.message}`, true);
        return 'error';
    }
}

async function sendSeekCommand(amount) {
    if (!selectedClientIp) {
        showNotification("Please select a client device first.", true);
        return 'error';
    }
    const seekValue = parseInt(amount, 10);
    if (isNaN(seekValue)) {
        showNotification("Please enter a valid number for seek amount.", true);
        return 'error';
    }

    const data = { action: 'seek', device_ip: selectedClientIp, seek_amount: seekValue };

    try {
        const response = await fetch('/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        showNotification(`Seek ${seekValue}s: ${result.message}`, result.status === 'error');
        getStatus();
        return result.status;
    } catch (error) {
        showNotification(`Error sending seek command: ${error.message}`, true);
        return 'error';
    }
}

async function toggleCcAndMute() {
    if (!selectedClientIp) {
        showNotification("Please select a client device first.", true);
        return;
    }

    const ccStatus = await sendCommand('toggle_cc');
    if (ccStatus === 'error') {
        showNotification("Failed to toggle Closed Captions.", true);
        return;
    }

    const muteStatus = await sendCommand('toggle_mute');
    if (muteStatus === 'error') {
        showNotification("Failed to toggle Mute.", true);
        return;
    }

    if (ccStatus === 'success' && muteStatus === 'success') {
        showNotification("Closed Captions and Mute toggled successfully.", false);
    }
}

async function rewindAndEnableCC() {
    if (!selectedClientIp) {
        showNotification("Please select a client device first.", true);
        return;
    }

    const seekStatus = await sendSeekCommand(-15);
    if (seekStatus === 'error') {
        showNotification("Failed to rewind.", true);
        return;
    }

    const ccToggleStatus = await sendCommand('toggle_cc');
    if (ccToggleStatus === 'success') {
        showNotification("Rewound 15s and Closed Captions toggled.", false);
    } else {
        showNotification("Rewound 15s, but failed to toggle Closed Captions.", true);
    }
}

async function getStatus() {
    if (!selectedClientIp) {
        statusDisplay.innerText = "No client selected.";
        nowPlayingDisplay.classList.add('hidden');
        return;
    }
    try {
        const response = await fetch(`/status?device_ip=${selectedClientIp}`);
        const status = await response.json();

        statusDisplay.innerText = JSON.stringify(status, null, 2);
        statusDisplay.style.display = 'block';

        if (status.status === 'error') {
            showNotification(`Status Error: ${status.message}`, true);
            nowPlayingDisplay.classList.add('hidden');
        } else {
            showNotification(`Status refreshed for ${selectedClientIp}.`, false);

            const np = status.now_playing;

            if (np && np.title) {
                let episodeDetails = '';
                if (np.season_number && np.episode_number) {
                    episodeDetails += `S${np.season_number} E${np.episode_number}`;
                    if (np.episode_title) {
                        episodeDetails += `: ${np.episode_title}`;
                    }
                } else if (np.episode_title) {
                    episodeDetails += np.episode_title;
                }

                nowPlayingDisplay.innerHTML = `
                    ${np.image_url ? `<img src="${np.image_url}" alt="Now Playing Image">` : ''}
                    <div id="now-playing-info">
                        <h3>${np.title}</h3>
                        ${episodeDetails ? `<p class="episode-details">${episodeDetails}</p>` : ''}
                        ${np.summary ? `<p class="summary">${np.summary}</p>` : ''}
                    </div>
                `;
                nowPlayingDisplay.classList.remove('hidden');
                statusDisplay.style.display = 'none';
            } else {
                nowPlayingDisplay.classList.add('hidden');
                statusDisplay.style.display = 'block';
                statusDisplay.innerText = "No 'Now Playing' information available (or not currently playing).\n\n" + statusDisplay.innerText;
            }
        }
    } catch (error) {
        statusDisplay.innerText = `Error fetching status: ${error.message}\nEnsure the Channels App is running on ${selectedClientIp} and reachable.`;
        nowPlayingDisplay.classList.add('hidden');
        statusDisplay.style.display = 'block';
        showNotification(`Status fetch error for ${selectedClientIp}: ${error.message}`, true);
    }
}

async function loadChannels() {
    if (!selectedClientIp) {
        channelSelect.innerHTML = '<option value="">Select a Client First</option>';
        channelSelect.disabled = true;
        return;
    }

    channelSelect.innerHTML = '<option value="">Loading Channels...</option>';
    channelSelect.disabled = true;

    try {
        const response = await fetch(`/channels_list?device_ip=${selectedClientIp}`);
        const channels = await response.json();

        channelSelect.innerHTML = '<option value="">Select a Channel</option>';

        if (channels.status === 'error') {
            showNotification(`Failed to load favorite channels: ${channels.message}`, true);
            channelSelect.innerHTML = `<option value="">Error: ${channels.message}</option>`;
        } else if (channels.length === 0) {
             channelSelect.innerHTML = '<option value="">No favorite channels found.</option>';
        } else {
            channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.channel_number;
                option.textContent = `${channel.channel_number} - ${channel.name}`;
                channelSelect.appendChild(option);
            });
            channelSelect.disabled = false;
            showNotification(`Favorite channels loaded for ${selectedClientIp}.`, false);
        }

    } catch (error) {
        showNotification(`Failed to fetch favorite channel list: ${error.message}`, true);
        channelSelect.innerHTML = '<option value="">Failed to load channels.</option>';
    }
}

function tuneToSelectedChannel() {
    const selectedChannel = channelSelect.value;
    if (selectedChannel) {
        sendCommand('play_channel', selectedChannel);
    }
}

let debounceTimeout;

function debounce(func, delay) {
    return function(...args) {
        const context = this;
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => func.apply(context, args), delay);
    };
}

async function loadMovies() {
    if (!selectedDvrServerIp || !selectedDvrServerPort) {
        moviesListDiv.innerHTML = '<p>Please select a DVR server to load movies.</p>';
        showNotification("Please select a DVR server to load movies.", true);
        allMoviesData = [];
        return;
    }
    moviesListDiv.innerHTML = '';
    moviesListDiv.classList.add('loading');
    showNotification("Loading movies from DVR server...", false);

    const sortBy = moviesSortBySelect.value;
    const sortOrder = moviesSortOrderSelect.value;

    try {
        const response = await fetch(`/dvr_movies?dvr_server_ip=${selectedDvrServerIp}&dvr_server_port=${selectedDvrServerPort}&sort_by=${sortBy}&sort_order=${sortOrder}`);
        const result = await response.json();

        moviesListDiv.classList.remove('loading');

        if (result.status === 'error') {
            moviesListDiv.innerHTML = `<p style="color: red;">Error: ${result.message}</p>`;
            showNotification(`Failed to load movies: ${result.message}`, true);
            allMoviesData = [];
        } else if (result.movies) {
            allMoviesData = result.movies;
            filterAndRenderMovies();
            showNotification(`Loaded ${result.movies.length} movies.`, false);
        } else {
            moviesListDiv.innerHTML = '<p>No movies found on the DVR server.</p>';
            showNotification("No movies found.", false);
            allMoviesData = [];
        }
        checkArrowVisibility(moviesListDiv);
    } catch (error) {
        moviesListDiv.innerHTML = `<p style="color: red;">Error fetching movies: ${error.message}</p>`;
        moviesListDiv.classList.remove('loading');
        showNotification(`Error fetching movies: ${error.message}`, true);
        console.error("Error fetching movies:", error);
        allMoviesData = [];
    }
}

function filterAndRenderMovies() {
    const searchTerm = moviesSearchInput.value.toLowerCase();
    const sortBy = moviesSortBySelect.value;
    const sortOrder = moviesSortOrderSelect.value;

    let filteredMovies = allMoviesData;

    if (searchTerm) {
        filteredMovies = allMoviesData.filter(movie =>
            (movie.title && movie.title.toLowerCase().includes(searchTerm)) ||
            (movie.summary && movie.summary.toLowerCase().includes(searchTerm))
        );
    }

    filteredMovies.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'alpha') {
            valA = a.title ? a.title.toLowerCase() : '';
            valB = b.title ? b.title.toLowerCase() : '';
        } else if (sortBy === 'date_released') {
            valA = a.air_date || 0;
            valB = b.air_date || 0;
        } else if (sortBy === 'duration') {
            valA = a.duration || 0;
            valB = b.duration || 0;
        } else {
            valA = a.title ? a.title.toLowerCase() : '';
            valB = b.title ? b.title.toLowerCase() : '';
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    renderMovies(filteredMovies);
}

function renderMovies(moviesToRender) {
    moviesListDiv.innerHTML = '';
    if (moviesToRender.length === 0) {
        moviesListDiv.innerHTML = '<p>No movies found matching your criteria.</p>';
        checkArrowVisibility(moviesListDiv);
        return;
    }

    moviesToRender.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';

        const imageUrl = movie.image_url || '';
        const hasImage = !!imageUrl; 
        
        const imageHtml = `
            <img src="${imageUrl}" alt="${movie.title || 'Movie'}" class="main-image"
                 style="${hasImage ? '' : 'display: none;'}" 
                 onerror="this.onerror=null; this.src='https://placehold.co/120x90/333/eee?text=No+Image';
                          this.classList.add('error-img');
                          this.style.display='none';
                          this.closest('.movie-card-image-container').querySelector('.no-image-text').style.display='block';" />
            <div class="no-image-text"
                 style="${hasImage ? 'display: none;' : 'display: block;'}">No Image Available</div>
        `;

        let movieDetails = '';
        if (movie.release_year) {
            movieDetails += `<p class="episode-details">Year: ${movie.release_year}</p>`;
        }
        if (movie.channel_call_sign) {
            movieDetails += `<p class="episode-details">Channel: ${movie.channel_call_sign}</p>`;
        }
       
        card.innerHTML = `
            <div class="movie-card-image-container">
                ${imageHtml}
            </div>
            <div class="movie-card-content">
                <h3>${movie.title || 'Unknown Title'}</h3>
                ${movieDetails}
                ${movie.summary ? `<p class="summary">${movie.summary}</p>` : ''}
                <div class="play-button-container">
                    <button class="control-button play-button" onclick="playRecording('${movie.id}')">Play</button>
                </div>
            </div>
        `;
        moviesListDiv.appendChild(card);
    });
    checkArrowVisibility(moviesListDiv);
}


async function loadShows() {
    if (!selectedDvrServerIp || !selectedDvrServerPort) {
        episodesListDiv.innerHTML = '<p>Please select a DVR server to load TV shows.</p>';
        showNotification("Please select a DVR server to load TV shows.", true);
        allEpisodesData = [];
        return;
    }
    episodesListDiv.innerHTML = '';
    episodesListDiv.classList.add('loading');
    showNotification("Loading TV show episodes from DVR server...", false);

    const sortBy = showsSortBySelect.value;
    const sortOrder = showsSortOrderSelect.value;

    let apiSortBy = sortBy;
    if (sortBy === 'episode_title') {
        apiSortBy = 'date_aired';
    }

    try {
        const response = await fetch(`/dvr_shows?dvr_server_ip=${selectedDvrServerIp}&dvr_server_port=${selectedDvrServerPort}&sort_by=${apiSortBy}&sort_order=${sortOrder}`);
        const result = await response.json();

        episodesListDiv.classList.remove('loading');

        if (result.status === 'error') {
            episodesListDiv.innerHTML = `<p style="color: red;">Error: ${result.message}</p>`;
            showNotification(`Failed to load TV show episodes: ${result.message}`, true);
            allEpisodesData = [];
        } else if (result.episodes) {
            allEpisodesData = result.episodes;
            filterAndRenderShows();
            showNotification(`Loaded ${result.episodes.length} TV show episodes.`, false);
        } else {
            episodesListDiv.innerHTML = '<p>No TV show episodes found on the DVR server.</p>';
            showNotification("No TV show episodes found.", false);
            allEpisodesData = [];
        }
        checkArrowVisibility(episodesListDiv);
    } catch (error) {
        episodesListDiv.innerHTML = `<p style="color: red;">Error fetching TV shows: ${error.message}</p>`;
        episodesListDiv.classList.remove('loading');
        showNotification(`Error fetching TV shows: ${error.message}`, true);
        console.error("Error fetching TV shows:", error);
        allEpisodesData = [];
    }
}

function filterAndRenderShows() {
    const searchTerm = showsSearchInput.value.toLowerCase();
    const sortBy = showsSortBySelect.value;
    const sortOrder = showsSortOrderSelect.value;

    let filteredEpisodes = allEpisodesData;

    if (searchTerm) {
        filteredEpisodes = allEpisodesData.filter(episode =>
            (episode.show_title && episode.show_title.toLowerCase().includes(searchTerm)) ||
            (episode.episode_title && episode.episode_title.toLowerCase().includes(searchTerm)) ||
            (episode.summary && episode.summary.toLowerCase().includes(searchTerm))
        );
    }

    filteredEpisodes.sort((a, b) => {
        let valA, valB;
        if (sortBy === 'title') {
            valA = a.show_title ? a.show_title.toLowerCase() : '';
            valB = b.show_title ? b.show_title.toLowerCase() : '';
        } else if (sortBy === 'episode_title') {
            valA = a.episode_title ? a.episode_title.toLowerCase() : '';
            valB = b.episode_title ? b.episode_title.toLowerCase() : '';
        } else if (sortBy === 'date_aired') {
            valA = a.air_date || 0;
            valB = b.air_date || 0;
        } else if (sortBy === 'date_added') {
            valA = a.date_added || 0;
            valB = b.date_added || 0;
        } else if (sortBy === 'duration') {
            valA = a.duration || 0;
            valB = b.duration || 0;
        }
         else {
            valA = a.air_date || 0;
            valB = b.air_date || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    renderShows(filteredEpisodes);
}

function renderShows(episodesToRender) {
    episodesListDiv.innerHTML = '';
    if (episodesToRender.length === 0) {
        episodesListDiv.innerHTML = '<p>No TV show episodes found matching your criteria.</p>';
        checkArrowVisibility(episodesListDiv);
        return;
    }

    episodesToRender.forEach(episode => {
        const card = document.createElement('div');
        card.className = 'episode-card';

        const imageUrl = episode.image_url || '';
        const hasImage = !!imageUrl;

        const imageHtml = `
            <img src="${imageUrl}" alt="${episode.show_title || 'Show'}" class="main-image"
                 style="${hasImage ? '' : 'display: none;'}" 
                 onerror="this.onerror=null; this.src='https://placehold.co/120x90/333/eee?text=No+Image';
                          this.classList.add('error-img');
                          this.style.display='none';
                          this.closest('.episode-card-image-container').querySelector('.no-image-text').style.display='block';" />
            <div class="no-image-text"
                 style="${hasImage ? 'display: none;' : 'display: block;'}">No Image Available</div>
        `;


        let episodeDetails = '';
        if (episode.season_number && episode.episode_number) {
            episodeDetails += `<p class="episode-details">S${episode.season_number} E${episode.episode_number}`;
            if (episode.episode_title) {
                episodeDetails += `: ${episode.episode_title}</p>`;
            } else {
                episodeDetails += `</p>`;
            }
        } else if (episode.episode_title) {
            episodeDetails += `<p class="episode-details">${episode.episode_title}</p>`;
        }
        if (episode.channel_call_sign) {
            episodeDetails += `<p class="episode-details">Channel: ${episode.channel_call_sign}</p>`;
        }
        if (episode.air_date) {
            const date = new Date(episode.air_date * 1000);
            episodeDetails += `<p class="episode-details">Aired: ${date.toLocaleDateString()}</p>`;
        }


        card.innerHTML = `
            <div class="episode-card-image-container">
                ${imageHtml}
            </div>
            <div class="episode-card-content">
                <h3>${episode.show_title || 'Unknown Show'}</h3>
                ${episodeDetails}
                ${episode.summary ? `<p class="summary">${episode.summary}</p>` : ''}
                <div class="play-button-container">
                    <button class="control-button play-button" onclick="playRecording('${episode.id}')">Play Episode</button>
                </div>
            </div>
        `;
        episodesListDiv.appendChild(card);
    });
    checkArrowVisibility(episodesListDiv);
}

async function playRecording(recordingId) {
    if (!selectedClientIp) {
        showNotification("Please select a Channels App client to play the content on.", true);
        return;
    }
    showNotification(`Attempting to play recording ${recordingId} on ${selectedClientIp}...`, false);
    const status = await sendCommand('play_recording', null, recordingId);
    if (status === 'success') {
        showNotification(`Playing recording ${recordingId}.`, false);
    } else {
        showNotification(`Failed to play recording ${recordingId}.`, true);
    }
}

function toggleSection(wrapperId, button) {
    const wrapperDiv = document.getElementById(wrapperId);
    const currentDisplay = window.getComputedStyle(wrapperDiv).display;

    if (currentDisplay === 'none') {
        wrapperDiv.style.display = 'block';
        button.textContent = 'Hide Content';
        const carouselDiv = wrapperDiv.querySelector('#movies-list, #episodes-list');
        if (carouselDiv) checkArrowVisibility(carouselDiv);
    } else {
        wrapperDiv.style.display = 'none';
        button.textContent = 'Show Content';
    }
}

function scrollCarousel(carouselElement, direction) {
    const scrollAmount = 150;
    carouselElement.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

function startAutoScroll(carouselElement, direction, event) {
    if (event) {
        event.preventDefault();
    }
    stopAutoScroll();
    autoScrollInterval = setInterval(() => {
        scrollCarousel(carouselElement, direction);
    }, 75);
}

function stopAutoScroll() {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
}

function checkArrowVisibility(carouselElement) {
    const wrapper = carouselElement.closest('.carousel-wrapper');
    if (!wrapper) return;

    const leftArrow = wrapper.querySelector('.scroll-arrow.left');
    const rightArrow = wrapper.querySelector('.scroll-arrow.right');

    if (!leftArrow || !rightArrow) return;

    const { scrollLeft, scrollWidth, clientWidth } = carouselElement;

    if (scrollLeft > 0) {
        leftArrow.classList.remove('hidden');
    } else {
        leftArrow.classList.add('hidden');
    }

    if (scrollLeft + clientWidth < scrollWidth - 1) {
        rightArrow.classList.remove('hidden');
    } else {
        rightArrow.classList.add('hidden');
    }
}

function setupCarouselNavigation() {
    const movieCarousel = document.getElementById('movies-list');
    const episodeCarousel = document.getElementById('episodes-list');

    if (movieCarousel) {
        movieCarousel.addEventListener('scroll', () => checkArrowVisibility(movieCarousel));
        checkArrowVisibility(movieCarousel);
    }
    if (episodeCarousel) {
        episodeCarousel.addEventListener('scroll', () => checkArrowVisibility(episodeCarousel));
        checkArrowVisibility(episodeCarousel);
    }

    window.addEventListener('resize', () => {
        if (movieCarousel) checkArrowVisibility(movieCarousel);
        if (episodeCarousel) checkArrowVisibility(episodeCarousel);
    });
}