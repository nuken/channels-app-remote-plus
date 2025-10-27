document.addEventListener('DOMContentLoaded', () => {
    const guideContainer = document.getElementById('program-guide');
    const themeSwitcher = document.getElementById('theme-switcher');
    const sourceFilter = document.getElementById('source-filter');
    
    const dvrBaseUrl = document.body.dataset.dvrUrl;
    let channelLogoMap = {}; // To store logos for fallback

    const applyTheme = () => {
        const currentTheme = localStorage.getItem('theme') || 'theme-light';
        document.body.className = currentTheme;
    };

    const toggleTheme = () => {
        const currentTheme = document.body.classList.contains('theme-dark') ? 'theme-light' : 'theme-dark';
        document.body.className = currentTheme;
        localStorage.setItem('theme', currentTheme);
    };

    const loadSourceFilters = async () => {
        try {
            const response = await fetch('/api/channels');
            const channels = await response.json();

            if (channels.error) { throw new Error(channels.message); }

            // --- IMAGE FIX ---
            // Create the logo map using 'station_id' as the key
            channels.forEach(channel => {
                if (channel.station_id) {
                    channelLogoMap[channel.station_id] = channel.logo_url;
                }
            });

            const sourceNames = [...new Set(channels.map(channel => channel.source_name))];
            
            sourceFilter.innerHTML = '<option value="all">All Sources</option>';
            sourceNames.sort().forEach(name => {
                if (name) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    sourceFilter.appendChild(option);
                }
            });

        } catch (error) {
            console.error('Failed to load source filters:', error);
        }
    };

    const loadGuide = async (source = 'all') => {
        guideContainer.innerHTML = '<p>Loading guide...</p>';

        try {
            const response = await fetch(`/api/guide?source=${encodeURIComponent(source)}`);
            const data = await response.json();

            if (data.error) { throw new Error(data.message); }
            guideContainer.innerHTML = '';

            if (data.length === 0) {
                guideContainer.innerHTML = '<p>No programs currently airing for this source.</p>';
                return;
            }

            data.forEach(channelData => {
                const program = channelData.Airings[0];
                const channel = channelData.Channel;
                if (!program || !channel) return;

                const card = document.createElement('div');
                card.className = 'channel-card';
                card.title = `Tune to ${channel.Name} (${channel.Number})`;

                // --- IMAGE FIX LOGIC ---
                // 1. Start with the program-specific image (relative URL)
                let imageUrl = program.Image ? `${dvrBaseUrl}${program.Image}` : null;
                
                // 2. If no program image, use our new logo map.
                // The guide data uses 'ChannelID' which matches our 'station_id' map key.
                if (!imageUrl) {
                    imageUrl = channelLogoMap[channel.ChannelID];
                }
                
                // 3. Last resort, try the channel image from the guide data (relative URL)
                if (!imageUrl && channel.Image) {
                    imageUrl = `${dvrBaseUrl}${channel.Image}`;
                }

                card.innerHTML = `
                    <div class="program-image">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${program.Title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
                        <span style="display: ${imageUrl ? 'none' : 'block'};">No Image</span>
                    </div>
                    <div class="channel-info">
                        <h3>${channel.Name} (${channel.Number})</h3>
                        <p class="program-title">${program.Title}</p>
                    </div>
                `;
                
                card.addEventListener('click', () => {
                    console.log(`Clicked on channel ${channel.Number}`);
                });

                guideContainer.appendChild(card);
            });

        } catch (error) {
            guideContainer.innerHTML = `<p style="color: red;">Error loading guide: ${error.message}.</p>`;
            console.error('Failed to load guide data:', error);
        }
    };

    const initialize = async () => {
        applyTheme();
        await loadSourceFilters();
        loadGuide();
    };

    themeSwitcher.addEventListener('click', toggleTheme);
    sourceFilter.addEventListener('change', () => loadGuide(sourceFilter.value));

    initialize();
});