const clientSelect = document.getElementById('client-select');
const dvrServerSelect = document.getElementById('dvr-server-select');
// const channelSelect = document.getElementById('channel-select'); // Removed from HTML, commenting out reference
const enablePopupsCheckbox = document.getElementById('enablePopups');
const notificationArea = document.getElementById('notification-area');
const statusDisplay = document.getElementById('status-display');
const nowPlayingDisplay = document.getElementById('now-playing-display');
const formattedStatusDisplay = document.getElementById('formatted-status-display');
const controlButtons = document.querySelectorAll('.control-button');
const themeSelect = document.getElementById('theme-select');
// const dvrServerIpDisplay = document.getElementById('dvr-server-ip-display'); // Removed from HTML
const moviesListDiv = document.getElementById('movies-list');
const episodesListDiv = document.getElementById('episodes-list');

// New elements for search and sort
const moviesSearchInput = document.getElementById('movies-search');
const moviesSortBySelect = document.getElementById('movies-sort-by');
const moviesSortOrderSelect = document.getElementById('movies-sort-order');

const showsSearchInput = document.getElementById('shows-search');
const showsSortBySelect = document.getElementById('shows-sort-by');
const showsSortOrderSelect = document.getElementById('shows-sort-order'); // Corrected typo here

// New elements for Channel Collections
const collectionSelect = document.getElementById('collection-select');
const channelCollectionsList = document.getElementById('channel-collections-list');
const channelCollectionSortBySelect = document.getElementById('channel-collection-sort-by');
const channelCollectionSortOrderSelect = document.getElementById('channel-collection-sort-order');

// NEW: Elements for expand button
const expandButton = document.getElementById('expandButton');


let selectedClientIp = '';
let selectedDvrServerIp = '';
let selectedDvrServerPort = '';
let autoScrollInterval;
let allMoviesData = [];
let allEpisodesData = [];
let allCollectionsData = []; // Store all collections including favorites
let favoriteChannelsData = []; // Store raw favorite channels data

// NEW: Global variable for channel refresh interval
let channelRefreshIntervalId = null;
const CHANNEL_REFRESH_INTERVAL_MS = 300000; // Refresh every 5 minutes (300000 ms)

function showNotification(message, isError = false) {
    if (!enablePopupsCheckbox.checked) {
        // console.log("Notification suppressed:", message);
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
    // channelSelect is now removed from index.html, no need to toggle its disabled state here
}

function applyTheme() {
    const selectedTheme = themeSelect.value;
    // console.log("applyTheme function called. Selected theme:", selectedTheme);

    document.documentElement.className = '';

    if (selectedTheme !== 'default-light') {
        document.documentElement.classList.add(`theme-${selectedTheme}`);
        // console.log(`applyTheme: Applied theme-${selectedTheme} to <html>.`);
    } else {
        // console.log("applyTheme: Reverting to default-light theme (no class added to <html>).");
    }
    localStorage.setItem('selectedTheme', selectedTheme);
    // console.log("applyTheme: Saved selectedTheme to localStorage:", selectedTheme);
}

// NEW: Function to toggle expanded layout
function toggleExpandedLayout() {
    const isExpanded = document.body.classList.toggle('expanded');
    localStorage.setItem('isExpandedLayout', isExpanded);
    expandButton.innerHTML = isExpanded ? '<i class="fa-solid fa-compress"></i> Shrink Layout' : '<i class="fa-solid fa-expand"></i> Expand Layout';
    expandButton.title = isExpanded ? 'Shrink the layout' : 'Expand the layout';

    // Trigger re-check of carousel arrows after layout change
    setupCarouselNavigation();
}


document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'default-light';
    // console.log("DOMContentLoaded: Initial savedTheme from localStorage:", savedTheme);
    themeSelect.value = savedTheme;
    // console.log("DOMContentLoaded: Set themeSelect dropdown value to:", themeSelect.value);

    const savedPopupState = localStorage.getItem('enablePopups');
    if (savedPopupState !== null) {
        enablePopupsCheckbox.checked = JSON.parse(savedPopupState);
    } else {
        enablePopupsCheckbox.checked = false;
    }

    enablePopupsCheckbox.addEventListener('change', () => {
        localStorage.setItem('enablePopups', enablePopupsCheckbox.checked);
    });

    const seekAmountInput = document.getElementById('seek_amount_input');
    seekAmountInput.addEventListener('click', () => {
        seekAmountInput.value = '';
    });

    // NEW: Load saved expanded layout state
    const isExpandedLayout = localStorage.getItem('isExpandedLayout');
    if (isExpandedLayout === 'true') {
        document.body.classList.add('expanded');
        expandButton.innerHTML = '<i class="fa-solid fa-compress"></i> Shrink Layout';
        expandButton.title = 'Shrink the layout';
    } else {
        expandButton.innerHTML = '<i class="fa-solid fa-expand"></i> Expand Layout';
        expandButton.title = 'Expand the layout';
    }
    expandButton.addEventListener('click', toggleExpandedLayout);


    // Load last selected DVR server IP:Port first, as it's needed for client discovery and collections
    const lastSelectedDvrServerIpPort = localStorage.getItem('lastSelectedDvrServerIpPort');
    let foundLastDvrServer = false;
    if (lastSelectedDvrServerIpPort) {
        const dvrServerOption = Array.from(dvrServerSelect.options).find(option => option.value === lastSelectedDvrServerIpPort);
        if (dvrServerOption) {
            dvrServerSelect.value = lastSelectedDvrServerIpPort;
            await selectDvrServer(); // Await this as it loads clients and sets selectedDvrServerIp/Port
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
    // console.log("[DEBUG] DOMContentLoaded: Initial selectedClientIp from localStorage:", lastSelectedClientIp); // ADDED LOG
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
        // console.log("[DEBUG] DOMContentLoaded: Selected first client as fallback."); // ADDED LOG
    } else if (clientSelect.options.length <= 1) { // No clients beyond the placeholder
        toggleControls(false);
        statusDisplay.innerText = "No Channels App clients configured/discovered. Please ensure a DVR server is selected and reachable.";
        nowPlayingDisplay.classList.add('hidden');
        showNotification("No Channels App clients configured/discovered.", true);
        // console.log("[DEBUG] DOMContentLoaded: No clients found, controls disabled."); // ADDED LOG
    }


    setupCarouselNavigation();

    moviesSearchInput.addEventListener('input', debounce(filterAndRenderMovies, 300));
    moviesSortBySelect.addEventListener('change', filterAndRenderMovies);
    moviesSortOrderSelect.addEventListener('change', filterAndRenderMovies);

    showsSearchInput.addEventListener('input', debounce(filterAndRenderShows, 300));
    showsSortBySelect.addEventListener('change', filterAndRenderShows);
    showsSortOrderSelect.addEventListener('change', filterAndRenderShows);

    // New: Event listeners for Channel Collections sorting
    channelCollectionSortBySelect.addEventListener('change', async () => {
        const selectedCollectionSlug = collectionSelect.value;
        if (selectedCollectionSlug) {
            const selectedCollection = allCollectionsData.find(col => col.slug === selectedCollectionSlug);
            if (selectedCollection) {
                await displayChannelsInCollection(selectedCollection.items, selectedCollection.isFavorites);
                startChannelRefresh(selectedCollection.items, selectedCollection.isFavorites); // Restart refresh with new sort
            }
        }
    });
    channelCollectionSortOrderSelect.addEventListener('change', async () => {
        const selectedCollectionSlug = collectionSelect.value;
        if (selectedCollectionSlug) {
            const selectedCollection = allCollectionsData.find(col => col.slug === selectedCollectionSlug);
            if (selectedCollection) {
                await displayChannelsInCollection(selectedCollection.items, selectedCollection.isFavorites);
                startChannelRefresh(selectedCollection.items, selectedCollection.isFavorites); // Restart refresh with new sort
            }
        }
    });

    // New: Event listeners for Send Message button and Send Notification button
    document.getElementById('sendMessageButton').addEventListener('click', function() {
        var messageForm = document.getElementById('messageForm');
        var sendMessageButton = document.getElementById('sendMessageButton'); // Get button reference
        if (messageForm.style.display === 'none') {
            messageForm.style.display = 'block';
            sendMessageButton.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Hide Message'; // Change text to "Hide Message"
            sendMessageButton.title = 'Hide the notification form';
        } else {
            messageForm.style.display = 'none';
            sendMessageButton.innerHTML = '<i class="fa-solid fa-comment-dots"></i> Send Message'; // Change text back to "Send Message"
            sendMessageButton.title = 'Show the notification form';
        }
    });

    document.getElementById('sendNotificationBtn').addEventListener('click', function() {
        var clientId = document.getElementById('client-select').value;
        var title = document.getElementById('notificationTitle').value;
        var message = document.getElementById('notificationBody').value;

        if (!clientId) {
            alert('Please select a client first.');
            return;
        }
        if (!title && !message) {
            alert('Please enter a title or message body.');
            return;
        }

        fetch('/send_notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                title: title,
                message: message
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Notification sent successfully!');
                document.getElementById('notificationTitle').value = '';
                document.getElementById('notificationBody').value = '';
                document.getElementById('messageForm').style.display = 'none';
                document.getElementById('sendMessageButton').innerHTML = '<i class="fa-solid fa-comment-dots"></i> Send Message'; // Reset button text on successful send
                document.getElementById('sendMessageButton').title = 'Show the notification form';
            } else {
                alert('Error sending notification: ' + data.message);
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            alert('Failed to send notification.');
        });
    });

    // New: Call fetchChannelCollections here after selectedDvrServerIp/Port are likely set
    if (selectedDvrServerIp && selectedDvrServerPort) {
        fetchChannelCollections();
    } else {
        // If no DVR server is selected on load, set a listener to load collections later
        dvrServerSelect.addEventListener('change', () => {
            if (selectedDvrServerIp && selectedDvrServerPort) {
                fetchChannelCollections();
            }
        }, { once: true }); // Only run once to avoid multiple fetches on subsequent changes
    }

    // Load and apply initial visibility states from localStorage
    applyInitialSectionVisibility('control-panel-content-wrapper');
    applyInitialSectionVisibility('movies-content-wrapper');
    applyInitialSectionVisibility('episodes-content-wrapper');
    applyInitialSectionVisibility('channel-collections-content-wrapper');
});

// Helper function to get full image URL, handling relative vs absolute paths
function getFullImageUrl(relativePath) {
    if (!relativePath) return '';
    // Check if the path is already an absolute URL (starts with http, https, or //)
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('//')) {
        return relativePath;
    }
    // If it's a relative path, and DVR server info is available, prepend the DVR server base URL
    if (selectedDvrServerIp && selectedDvrServerPort) {
        return `http://${selectedDvrServerIp}:${selectedDvrServerPort}${relativePath}`;
    }
    return relativePath; // Fallback for relative paths if DVR server info isn't available
}

// NEW: Function to start the channel refresh interval
function startChannelRefresh(collectionItems, isFavorites) {
    stopChannelRefresh(); // Clear any existing interval
    channelRefreshIntervalId = setInterval(async () => {
        // console.log("Automatically refreshing channel collection data...");
        await displayChannelsInCollection(collectionItems, isFavorites);
    }, CHANNEL_REFRESH_INTERVAL_MS);
}

// NEW: Function to stop the channel refresh interval
function stopChannelRefresh() {
    if (channelRefreshIntervalId) {
        clearInterval(channelRefreshIntervalId);
        channelRefreshIntervalId = null;
        // console.log("Stopped channel collection auto-refresh.");
    }
}


async function selectClient() {
    selectedClientIp = clientSelect.value;
    if (selectedClientIp) {
        localStorage.setItem('lastSelectedClientIp', selectedClientIp);
        // console.log("[DEBUG] selectClient: Saved selectedClientIp to localStorage:", selectedClientIp); // ADDED LOG
        showNotification(`Controlling: ${clientSelect.options[clientSelect.selectedIndex].text}`, false);
        toggleControls(true);
        getStatus();
        // loadChannels() is now removed, no call here
        fetchChannelCollections(); // Re-fetch collections to update favorites based on new client
    } else {
        localStorage.removeItem('lastSelectedClientIp');
        // console.log("[DEBUG] selectClient: Cleared lastSelectedClientIp from localStorage (no client selected)."); // ADDED LOG
        showNotification("Please select a client device.", true);
        toggleControls(false);
        statusDisplay.innerText = "Select a client and click \"Refresh Status\" to fetch.";
        nowPlayingDisplay.classList.add('hidden');
        formattedStatusDisplay.classList.add('hidden');
        // channelSelect.innerHTML = '<option value="">Select a Client First</option>'; // No longer needed
        fetchChannelCollections(); // Re-fetch collections to clear favorites if client unselected
        stopChannelRefresh(); // Stop refresh if client is deselected
    }
}

// MODIFIED: This function now dynamically loads clients for the selected DVR server AND triggers collection/movie/show loads
async function selectDvrServer() {
    const selectedValue = dvrServerSelect.value;
    if (selectedValue) {
        const [ip, port] = selectedValue.split(':');
        selectedDvrServerIp = ip; 
        selectedDvrServerPort = port;
        localStorage.setItem('lastSelectedDvrServerIpPort', selectedValue);
        // console.log("[DEBUG] selectDvrServer: Saved lastSelectedDvrServerIpPort to localStorage:", selectedValue); // ADDED LOG
        // dvrServerIpDisplay.textContent = `Selected: ${selectedValue}`; // REMOVED
        // dvrServerIpDisplay.style.display = 'inline'; // REMOVED
        showNotification(`DVR Server selected: ${selectedValue}`, false);
        
        // --- NEW: Fetch and populate clients for the selected DVR server ---
        await fetchClientsForDvrServer(selectedDvrServerIp, selectedDvrServerPort);

        // Now that DVR server is selected, fetch collections, movies, and shows
        fetchChannelCollections();
        loadMovies();
        loadShows();
    } else {
        localStorage.removeItem('lastSelectedDvrServerIpPort');
        // console.log("[DEBUG] selectDvrServer: Cleared lastSelectedDvrServerIpPort from localStorage (no DVR server selected)."); // ADDED LOG
        // dvrServerIpDisplay.textContent = 'Not Selected'; // REMOVED
        // dvrServerIpDisplay.style.display = 'none'; // REMOVED
        moviesListDiv.innerHTML = '<p>Please select a DVR server to load movies.</p>';
        episodesListDiv.innerHTML = '<p>Please select a DVR server to load episodes.</p>';
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
        formattedStatusDisplay.classList.add('hidden');
        channelCollectionsList.innerHTML = '<p>Please select a DVR server to load channel collections.</p>'; // Clear collections
        collectionSelect.innerHTML = '<option value="">Select a Collection</option>'; // Clear collection dropdown
        collectionSelect.disabled = true;
        channelCollectionSortBySelect.disabled = true; // Disable sort dropdowns
        channelCollectionSortOrderSelect.disabled = true;
        stopChannelRefresh(); // Stop refresh if DVR server is deselected
    }
}

// NEW FUNCTION: To fetch clients for a specific DVR server
async function fetchClientsForDvrServer(dvrIp, dvrPort) {
    clientSelect.innerHTML = '<option value="">Loading Clients...</option>';
    clientSelect.disabled = true;
    selectedClientIp = ''; // Clear previously selected client. This does NOT clear localStorage.
    toggleControls(false); // Disable controls while clients are loading
    // console.log("[DEBUG] fetchClientsForDvrServer: Starting client discovery for", dvrIp, dvrPort); // ADDED LOG

    try {
        const response = await fetch(`/dvr_clients?dvr_server_ip=${dvrIp}&dvr_server_port=${dvrPort}`);
        const result = await response.json();

        clientSelect.innerHTML = '<option value="">Select a Client</option>'; // Reset dropdown

        if (result.status === 'error') {
            showNotification(`Failed to load clients: ${result.message}`, true);
            clientSelect.innerHTML = `<option value="">Error: ${result.message}</option>`;
            clientSelect.disabled = true;
            // console.log("[DEBUG] fetchClientsForDvrServer: Client discovery error:", result.message); // ADDED LOG
            // MODIFIED: Clear localStorage and selectedClientIp on error as well
            selectedClientIp = '';
            localStorage.removeItem('lastSelectedClientIp');
        } else if (result.clients && result.clients.length > 0) {
            result.clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.ip;
                option.textContent = `${client.name} (${client.ip})`;
                clientSelect.appendChild(option);
            });
            clientSelect.disabled = false;
            showNotification(`Loaded ${result.clients.length} clients for ${dvrIp}:${dvrPort}.`, false);
            // console.log("[DEBUG] fetchClientsForDvrServer: Clients loaded. Current clientSelect.options:", Array.from(clientSelect.options).map(o => o.value)); // ADDED LOG

            const lastSelectedClient = localStorage.getItem('lastSelectedClientIp'); // Read the value AFTER clients are populated
            const foundClientInNewList = result.clients.find(client => client.ip === lastSelectedClient);
            // console.log("[DEBUG] fetchClientsForDvrServer: Attempting re-selection. lastSelectedClient:", lastSelectedClient, "foundInNewList:", !!foundClientInNewList); // ADDED LOG

            if (foundClientInNewList) {
                clientSelect.value = lastSelectedClient; // Re-select if it was found
                await selectClient();
                // console.log("[DEBUG] fetchClientsForDvrServer: Re-selecting last client:", lastSelectedClient); // ADDED LOG
            } else { // If last client not found or no previous selection, select first available if any
                if (result.clients.length > 0) {
                    clientSelect.selectedIndex = 1; // Select the first actual client (index 0 is "Select a Client")
                    await selectClient();
                    // console.log("[DEBUG] fetchClientsForDvrServer: Last client not found or no previous selection, selecting first client:", clientSelect.value); // ADDED LOG
                } else { // Should not happen if result.clients.length > 0 but good for robustness
                    selectedClientIp = ''; // Ensure selectedClientIp is reset
                    localStorage.removeItem('lastSelectedClientIp'); // Clear invalid selection HERE
                    toggleControls(false); // Disable controls
                    statusDisplay.innerText = "No eligible client selected/found.";
                    nowPlayingDisplay.classList.add('hidden');
                    // console.log("[DEBUG] fetchClientsForDvrServer: No clients found by discovery. Clearing selection."); // ADDED LOG
                }
            }
            
        } else { // No clients found by discovery at all
            showNotification(`No eligible clients found for ${dvrIp}:${dvrPort}.`, false);
            clientSelect.innerHTML = '<option value="">No Clients Found</option>';
            clientSelect.disabled = true;
            selectedClientIp = ''; // Ensure selectedClientIp is reset
            localStorage.removeItem('lastSelectedClientIp'); // Clear invalid selection HERE (if result.clients is empty)
            // console.log("[DEBUG] fetchClientsForDvrServer: No clients found by discovery. Clearing selection."); // ADDED LOG
        }
    } catch (error) {
        showNotification(`Error fetching clients for DVR server ${dvrIp}:${dvrPort}: ${error.message}`, true);
        clientSelect.innerHTML = '<option value="">Failed to load clients.</option>';
        clientSelect.disabled = true;
        selectedClientIp = ''; // Ensure selectedClientIp is reset
        localStorage.removeItem('lastSelectedClientIp'); // Clear invalid selection HERE (on error)
        console.error("Error fetching clients:", error);
        // console.log("[DEBUG] fetchClientsForDvrServer: Error during client fetch. Clearing selection:", error); // ADDED LOG
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
    let seekValue = parseInt(amount, 10);
    if (isNaN(seekValue)) {
        showNotification("Please enter a valid number for seek amount.", true);
        return 'error';
    }

    const seekUnit = document.querySelector('input[name="seek-unit"]:checked').value;
    if (seekUnit === 'minutes') {
        seekValue *= 60;
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

// NEW: Function to toggle recording
async function toggleRecord() {
    if (!selectedClientIp) {
        showNotification("Please select a client device first.", true);
        return;
    }
    const status = await sendCommand('toggle_record');
    if (status === 'success') {
        showNotification("Recording toggled.", false);
    } else {
        showNotification("Failed to toggle recording.", true);
    }
}

async function getStatus() {
    if (!selectedClientIp) {
        nowPlayingDisplay.classList.add('hidden');
        formattedStatusDisplay.classList.add('hidden');
        return;
    }

    nowPlayingDisplay.classList.add('hidden');
    statusDisplay.style.display = 'none';
    formattedStatusDisplay.classList.add('hidden');

    try {
        const response = await fetch(`/status?device_ip=${selectedClientIp}`);
        const status = await response.json();

        if (status.status === 'error') {
            showNotification(`Status Error: ${status.message}`, true);
            formattedStatusDisplay.innerHTML = `<div class="formatted-status error"><i class="fa-solid fa-power-off"></i> Client Offline</div>`;
            formattedStatusDisplay.classList.remove('hidden');
        } else {
            showNotification(`Status refreshed for ${selectedClientIp}.`, false);

            const np = status.now_playing;
            const channel = status.channel;

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

                const imageUrl = getFullImageUrl(np.image_url);

                let channelInfoHtml = '';
                if (channel && channel.name && channel.number) {
                    channelInfoHtml = `<p class="channel-info">${channel.name} (${channel.number})</p>`;
                } else if (channel && channel.name) {
                    channelInfoHtml = `<p class="channel-info">${channel.name}</p>`;
                } else if (channel && channel.number) {
                    channelInfoHtml = `<p class="channel-info">Channel ${channel.number}</p>`;
                }

                nowPlayingDisplay.innerHTML = `
                    ${imageUrl ? `<img src="${imageUrl}" alt="Now Playing Image">` : ''}
                    <div id="now-playing-info">
                        <h3>${np.title}</h3>
                        ${episodeDetails ? `<p class="episode-details">${episodeDetails}</p>` : ''}
                        ${channelInfoHtml}
                        ${np.summary ? `<p class="summary">${np.summary}</p>` : ''}
                    </div>
                `;
                nowPlayingDisplay.classList.remove('hidden');
            } else {
                let channelOnlyInfoHtml = '';
                const statusChannel = status.channel;
                if (statusChannel && statusChannel.name && statusChannel.number) {
                    channelOnlyInfoHtml = `<h3>${statusChannel.name} (${statusChannel.number})</h3><p>No current program details available.</p>`;
                } else if (statusChannel && statusChannel.name) {
                    channelOnlyInfoHtml = `<h3>${statusChannel.name}</h3><p>No current program details available.</p>`;
                } else if (statusChannel && statusChannel.number) {
                    channelOnlyInfoHtml = `<h3>Channel ${statusChannel.number}</h3><p>No current program details available.</p>`;
                }

                if (channelOnlyInfoHtml) {
                    nowPlayingDisplay.innerHTML = `<div id="now-playing-info">${channelOnlyInfoHtml}</div>`;
                    nowPlayingDisplay.classList.remove('hidden');
                } else {
                    formattedStatusDisplay.innerHTML = `<div class="formatted-status"><i class="fa-solid fa-bed"></i> Nothing Playing</div>`;
                    formattedStatusDisplay.classList.remove('hidden');
                }
            }
        }
    } catch (error) {
        formattedStatusDisplay.innerHTML = `<div class="formatted-status error"><i class="fa-solid fa-power-off"></i> Client Offline</div>`;
        formattedStatusDisplay.classList.remove('hidden');
        showNotification(`Status fetch error for ${selectedClientIp}: ${error.message}`, true);
    }
}

// Removed: loadChannels function is no longer needed here as favorites are integrated into collections
// async function loadChannels() { ... }

// Removed: tuneToSelectedChannel function is no longer needed here
// function tuneToSelectedChannel() { ... }

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
    }
    catch (error) {
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

        // MODIFIED: Use getFullImageUrl helper
        const imageUrl = getFullImageUrl(movie.image_url);
        const hasImage = !!imageUrl;

        const imageHtml = `
            <img src="${imageUrl}" alt="${movie.title || 'Movie'}" class="main-image"
                 style="${hasImage ? '' : 'display: none;'}"
                 onerror="this.onerror=null; this.src='https://placehold.co/120x90/333/eee?text=No+Image';
                          this.classList.add('error-img');
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
                    <button class="control-button play-button" onclick="playRecording('${movie.id}')" title="Play this movie"><i class="fa-solid fa-play"></i> Play</button>
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

        // MODIFIED: Use getFullImageUrl helper
        const imageUrl = getFullImageUrl(episode.image_url);
        const hasImage = !!imageUrl;

        const imageHtml = `
            <img src="${imageUrl}" alt="${episode.show_title || 'Show'}" class="main-image"
                 style="${hasImage ? '' : 'display: none;'}"
                 onerror="this.onerror=null; this.src='https://placehold.co/120x90/333/eee?text=No+Image';
                          this.classList.add('error-img');
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
                episodeDetails += `</p`;
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
                    <button class="control-button play-button" onclick="playRecording('${episode.id}')" title="Play this episode"><i class="fa-solid fa-play"></i> Play Episode</button>
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

function toggleSection(wrapperId, headerElement) {
    const wrapperDiv = document.getElementById(wrapperId);
    if (!wrapperDiv) {
        return;
    }
    const isHidden = window.getComputedStyle(wrapperDiv).display === 'none';
    const button = headerElement.querySelector('.section-toggle-button');


    if (isHidden) {
        wrapperDiv.style.display = 'block';
        headerElement.classList.remove('is-collapsed');
        const carouselDiv = wrapperDiv.querySelector('#movies-list, #episodes-list, #channel-collections-list');
        if (carouselDiv) checkArrowVisibility(carouselDiv);
        localStorage.setItem(wrapperId + 'Visible', 'true');
    } else {
        wrapperDiv.style.display = 'none';
        headerElement.classList.add('is-collapsed');
        localStorage.setItem(wrapperId + 'Visible', 'false');
    }
}

function applyInitialSectionVisibility(wrapperId) {
    const wrapperDiv = document.getElementById(wrapperId);
    if (wrapperDiv) {
        const savedState = localStorage.getItem(wrapperId + 'Visible');
        const headerElement = wrapperDiv.previousElementSibling;

        if (savedState === 'true') {
            wrapperDiv.style.display = 'block';
            if (headerElement) {
                headerElement.classList.remove('is-collapsed');
            }
        } else {
            wrapperDiv.style.display = 'none';
            if (headerElement) {
                headerElement.classList.add('is-collapsed');
            }
        }
    }
}


function scrollCarousel(carouselElement, direction) {
    const scrollAmount = carouselElement.clientWidth * 0.8; 
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
    scrollCarousel(carouselElement, direction);
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
    const channelCollectionsCarousel = document.getElementById('channel-collections-list');

    if (movieCarousel) {
        movieCarousel.addEventListener('scroll', () => checkArrowVisibility(movieCarousel));
        checkArrowVisibility(movieCarousel);
    }
    if (episodeCarousel) {
        episodeCarousel.addEventListener('scroll', () => checkArrowVisibility(episodeCarousel));
        checkArrowVisibility(episodeCarousel);
    }
    if (channelCollectionsCarousel) {
        channelCollectionsCarousel.addEventListener('scroll', () => checkArrowVisibility(channelCollectionsCarousel));
        checkArrowVisibility(channelCollectionsCarousel);
    }

    window.addEventListener('resize', () => {
        if (movieCarousel) checkArrowVisibility(movieCarousel);
        if (episodeCarousel) checkArrowVisibility(episodeCarousel);
        if (channelCollectionsCarousel) checkArrowVisibility(channelCollectionsCarousel);
    });
}

const fetchChannelCollections = async () => {
    if (!selectedDvrServerIp || !selectedDvrServerPort) {
        channelCollectionsList.innerHTML = '<p>Please select a DVR server to load channel collections.</p>';
        collectionSelect.innerHTML = '<option value="">Select a Collection</option>';
        collectionSelect.disabled = true;
        channelCollectionSortBySelect.disabled = true;
        channelCollectionSortOrderSelect.disabled = true;
        showNotification("Please select a DVR server to load channel collections.", true);
        stopChannelRefresh();
        return;
    }

    channelCollectionsList.innerHTML = '<p>Loading collections...</p>';
    
    try {
        const collectionsResponse = await fetch(`/collections_list?dvr_server_ip=${selectedDvrServerIp}&dvr_server_port=${selectedDvrServerPort}`);
        if (!collectionsResponse.ok) {
            const errorData = await collectionsResponse.json();
            throw new Error(`Server error fetching collections: ${collectionsResponse.status} - ${errorData.message || collectionsResponse.statusText}`);
        }
        let collections = await collectionsResponse.json();

        if (selectedClientIp) {
            try {
                const favoritesResponse = await fetch(`/channels_list?device_ip=${selectedClientIp}`);
                if (!favoritesResponse.ok) {
                    throw new Error('Client is off or unreachable');
                }
                favoriteChannelsData = await favoritesResponse.json();
                const favoriteChannelNumbers = favoriteChannelsData.map(c => c.number);
                collections.unshift({
                    name: "Favorites",
                    slug: "favorites",
                    items: favoriteChannelNumbers,
                    isFavorites: true
                });
            } catch (error) {
                console.warn(`Failed to load favorite channels. Client may be off or unreachable.`);
                showNotification(`Warning: Could not load favorites. Client is off or unreachable.`, true);
                favoriteChannelsData = [];
            }
        } else {
             favoriteChannelsData = []; 
        }

        allCollectionsData = collections;

        collectionSelect.innerHTML = '<option value="">Select a Collection</option>';
        allCollectionsData.forEach(collection => {
            const option = document.createElement('option');
            option.value = collection.slug;
            option.textContent = collection.name;
            collectionSelect.appendChild(option);
        });
        collectionSelect.disabled = false;
        channelCollectionSortBySelect.disabled = false;
        channelCollectionSortOrderSelect.disabled = false;

        collectionSelect.removeEventListener('change', onCollectionSelectChange);
        collectionSelect.addEventListener('change', onCollectionSelectChange);
        
        if (allCollectionsData.length > 0) {
            const favoritesCollection = allCollectionsData.find(col => col.slug === 'favorites');
            if (favoritesCollection) {
                collectionSelect.value = favoritesCollection.slug;
                await displayChannelsInCollection(favoritesCollection.items, true);
                startChannelRefresh(favoritesCollection.items, true);
            } else {
                collectionSelect.value = allCollectionsData[0].slug;
                await displayChannelsInCollection(allCollectionsData[0].items, allCollectionsData[0].isFavorites);
                startChannelRefresh(allCollectionsData[0].items, allCollectionsData[0].isFavorites);
            }
        } else {
            channelCollectionsList.innerHTML = '<p>No channel collections found on this DVR server.</p>';
            collectionSelect.disabled = true;
            channelCollectionSortBySelect.disabled = true;
            channelCollectionSortOrderSelect.disabled = true;
            stopChannelRefresh();
        }

    } catch (error) {
        console.error('Error fetching channel collections:', error);
        channelCollectionsList.innerHTML = `<p>Error loading channel collections: ${error.message}. Please ensure the DVR server is running and accessible.</p>`;
        collectionSelect.innerHTML = '<option value="">Error loading collections</option>';
        collectionSelect.disabled = true;
        channelCollectionSortBySelect.disabled = true;
        channelCollectionSortOrderSelect.disabled = true;
        showNotification(`Error loading collections: ${error.message}`, true);
        stopChannelRefresh();
    }
};

async function onCollectionSelectChange(event) {
    const selectedCollectionSlug = event.target.value;
    stopChannelRefresh();
    if (selectedCollectionSlug) {
        const selectedCollection = allCollectionsData.find(col => col.slug === selectedCollectionSlug);
        if (selectedCollection) {
            await displayChannelsInCollection(selectedCollection.items, selectedCollection.isFavorites);
            startChannelRefresh(selectedCollection.items, selectedCollection.isFavorites);
        }
    } else {
        channelCollectionsList.innerHTML = '';
    }
}

const displayChannelsInCollection = async (channelIdentifiers, isFavoritesCollection = false) => {
    if (!selectedDvrServerIp || !selectedDvrServerPort) {
        channelCollectionsList.innerHTML = '<p>Please select a DVR server to load channel information.</p>';
        showNotification("Please select a DVR server to load channel information.", true);
        stopChannelRefresh();
        return;
    }
    if (!selectedClientIp && isFavoritesCollection) {
        channelCollectionsList.innerHTML = '<p>Please select a Channels App client to view Favorite Channels.</p>';
        stopChannelRefresh();
        return;
    }

    channelCollectionsList.innerHTML = '<p>Loading channels...</p>';
    channelCollectionsList.classList.add('loading');

    try {
        const nowPlayingResponse = await fetch(`/now_playing_data?dvr_server_ip=${selectedDvrServerIp}&dvr_server_port=${selectedDvrServerPort}`);
        if (!nowPlayingResponse.ok) {
            const errorData = await nowPlayingResponse.json();
            throw new Error(`Server error fetching now playing data: ${nowPlayingResponse.status} - ${errorData.message || nowPlayingResponse.statusText}`);
        }
        const nowPlayingData = await nowPlayingResponse.json();

        let channelsToDisplay = [];

        if (isFavoritesCollection) {
            const favoriteChannelNumbers = favoriteChannelsData.map(fav => fav.number);
            channelsToDisplay = nowPlayingData.filter(item =>
                favoriteChannelNumbers.includes(item.Channel.Number)
            ).map(item => {
                const favChannel = favoriteChannelsData.find(fav => fav.number === item.Channel.Number);
                const imageUrl = (item.Airings[0] && item.Airings[0].Image) || (favChannel ? favChannel.image_url : '') || item.Channel.Image;
                return { ...item,
                    Channel: { ...item.Channel, Image: imageUrl },
                    Airings: item.Airings || []
                };
            });

        } else {
            channelsToDisplay = nowPlayingData.filter(item =>
                channelIdentifiers.includes(item.Channel.ChannelID) ||
                channelIdentifiers.includes(item.Channel.Number) ||
                channelIdentifiers.includes(item.Channel.Name)
            );
        }

        const sortBy = channelCollectionSortBySelect.value;
        const sortOrder = channelCollectionSortOrderSelect.value;

        channelsToDisplay.sort((a, b) => {
            let valA, valB;

            if (sortBy === 'number') {
                valA = parseFloat(a.Channel.Number);
                valB = parseFloat(b.Channel.Number);
            } else if (sortBy === 'name') {
                valA = a.Channel.Name.toLowerCase();
                valB = b.Channel.Name.toLowerCase();
            } else if (sortBy === 'title') {
                valA = a.Airings[0] && a.Airings[0].Title ? a.Airings[0].Title.toLowerCase() : '';
                valB = b.Airings[0] && b.Airings[0].Title ? b.Airings[0].Title.toLowerCase() : '';
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        channelCollectionsList.innerHTML = '';
        channelCollectionsList.classList.remove('loading');

        if (channelsToDisplay.length > 0) {
            channelsToDisplay.forEach(item => {
                const card = document.createElement('div');
                card.classList.add('channel-card');
                card.classList.add('movie-card');

                const imageUrl = getFullImageUrl((item.Airings[0] && item.Airings[0].Image) || item.Channel.Image);
                const hasImage = !!imageUrl;

                const imageHtml = `
                    <div class="channel-card-image-container">
                        <img src="${imageUrl}" alt="${item.Channel.Name}" class="main-image"
                             style="${hasImage ? '' : 'display: none;'}"
                             onerror="this.onerror=null; this.src='https://placehold.co/120x90/333/eee?text=No+Image';
                                      this.classList.add('error-img');
                                      this.style.display='none';
                                      this.closest('.channel-card-image-container').querySelector('.no-image-text').style.display='block';" />
                        <div class="no-image-text"
                             style="${hasImage ? 'display: none;' : 'display: block;'}">No Image Available</div>
                    </div>
                    <div class="channel-card-content">
                        <h3>${item.Channel.Name} (${item.Channel.Number})</h3>
                        <p class="episode-details">${item.Airings[0] ? item.Airings[0].Title : 'No Program Info'}</p>
                        ${item.Airings[0] && item.Airings[0].Summary ? `<p class="summary">${item.Airings[0].Summary}</p>` : ''}
                        <div class="play-button-container">
                            <button class="control-button play-button" onclick="playChannel('${item.Channel.Number}')" title="Tune to this channel"><i class="fa-solid fa-play"></i> Tune In</button>
                        </div>
                    </div>
                `;
                card.innerHTML = imageHtml;
                channelCollectionsList.appendChild(card);
            });
            checkArrowVisibility(channelCollectionsList);
        } else {
            channelCollectionsList.innerHTML = '<p>No channels found in this collection or no "now playing" data available for them.</p>';
            checkArrowVisibility(channelCollectionsList);
        }

    } catch (error) {
        console.error('Error fetching now playing data for collection:', error);
        channelCollectionsList.innerHTML = `<p>Error loading channel information: ${error.message}. Please ensure the DVR server is running and accessible.</p>`;
        channelCollectionsList.classList.remove('loading');
        showNotification(`Error loading channel info: ${error.message}`, true);
        stopChannelRefresh();
    }
};

const playChannel = async (channelNumber) => {
    if (!selectedClientIp) {
        showNotification("Please select a Channels App client first to play the channel.", true);
        return;
    }
    sendCommand('play_channel', channelNumber);
};

document.addEventListener('DOMContentLoaded', () => {
    const voiceControlBtn = document.getElementById('voice-control-btn');

    // Check if the browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceControlBtn.disabled = true;
        voiceControlBtn.textContent = 'Voice Not Supported';
        console.error("Speech Recognition API is not supported in this browser.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Listen for a single command
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // Event handler for the voice control button
    voiceControlBtn.addEventListener('click', () => {
        recognition.start();
        showNotification('Listening for a command...', false);
        voiceControlBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i> Listening...';
        voiceControlBtn.disabled = true;
    });

    // Process the recognized speech
    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase().trim();
        showNotification(`Command heard: "${command}"`, false);
        handleVoiceCommand(command);
    };

    // Handle end of listening
    recognition.onend = () => {
        voiceControlBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Voice';
        voiceControlBtn.disabled = false;
    };
    
    // Handle errors
    recognition.onerror = (event) => {
        showNotification(`Voice recognition error: ${event.error}`, true);
    };

    // Function to map voice commands to actions
    function handleVoiceCommand(command) {
        const forwardMatch = command.match(/^forward (\d+) seconds?$/);
        const backMatch = command.match(/^(?:back|rewind) (\d+) seconds?$/);

        if (command.includes('pause') || command.includes('play')) {
            sendCommand('toggle_pause');
        } else if (command.includes('stop')) {
            sendCommand('stop');
        } else if (command.includes('mute')) {
            sendCommand('toggle_mute');
        } else if (command.includes('caption') || command.includes('close caption')) {
            sendCommand('toggle_cc');
        } else if (command.includes('replay')) {
            sendSeekCommand(-10);
        } else if (backMatch) {
            const seconds = parseInt(backMatch[1], 10);
            sendSeekCommand(-seconds);
        } else if (forwardMatch) {
            const seconds = parseInt(forwardMatch[1], 10);
            sendSeekCommand(seconds);
        } else if (command.includes('channel up')) {
            sendCommand('channel_up');
        } else if (command.includes('channel down')) {
            sendCommand('channel_down');
        } else if (command.includes('previous channel')) {
            sendCommand('previous_channel');
        } else if (command.startsWith('tune to channel')) {
            const channelNumber = command.replace('tune to channel', '').trim();
            if (channelNumber) {
                sendCommand('play_channel', channelNumber);
            }
        } else if (command.includes('go to guide')) {
             sendCommand('navigate', 'Guide');
        } else if (command.includes('go to library')) {
             sendCommand('navigate', 'Library');
        } else {
            showNotification(`Unknown command: "${command}"`, true);
        }
    }
});