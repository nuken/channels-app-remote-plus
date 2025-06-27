# Channels DVR Remote Plus

This is a web-based remote control for your Channels DVR client apps (e.g., Apple TV, Fire TV, Google TV), now with integration for your Channels DVR Server for Browse and playing recorded content. It's designed for simple control and mobile use.

## Limitations

  * **No Generic UI Navigation:** Does not provide "Up, Down, Left, Right" D-pad controls for general app navigation within the Channels app.
  * **Local Network Only:** For security, it's intended for use only within your local network.

## Features

  * **Multi-Client Control:** Select and control different Channels app clients.
  * **Multi-Server Support:** Ability to use multiple server installs.
  * **Basic Playback:** Play/Pause, Stop, Mute.
  * **Channel Control:** Channel Up/Down, Previous Channel, Manual channel entry, Tune to favorite channels (fetched from the client).
  * **Adjustable Seek:** Jump forward/backward by custom seconds.
  * **App Navigation:** Go directly to Live TV, Guide, Library, or Search sections.
  * **Browse & Play DVR Movies:** Load and play movies recorded on your Channels DVR Server.
  * **Browse & Play Recent TV Show Episodes:** Load and play recently recorded TV show episodes from your Channels DVR Server.
  * **Real-time Status:** View current playback status.
  * **Toggle Notifications:** Enable/disable status pop-up notifications (off by default for mobile).
  * **Mobile-Friendly:** Responsive design for various screen sizes.
  * **Theming Options:** Select between different light and dark themes.

## Installation

This remote is deployed as a Docker image.

### 1\. Pull the Docker Image

```bash
docker pull rcvaughn2/channels-remote-plus
```

### 2\. Run the Docker Container

Provide your Channels DVR Server(s) as a comma-separated list of `Name:IP` pairs using the `CHANNELS_DVR_SERVERS` environment variable. Ensure no spaces around commas or colons. 

**Example Command:**

```bash
docker run -d --restart unless-stopped \
  -p 5020:5000 \
  -e "CHANNELS_DVR_SERVERS=Home DVR:192.168.86.64" \
  --name channels-remote \
  rcvaughn2/channels-remote-plus
```

  * `-d`: Run in detached mode.
  * `--restart unless-stopped`: Restart automatically on Docker daemon start.
  * `-p 5020:5000`: Maps host port 5020 to container port 5000 (change 5020 if needed on your host).
  * `-e "CHANNELS_DVR_SERVERS=..."`: Your Channels DVR Server name(s) and IP(s).
  * `--name channels-remote`: Assigns a name to the container.

### 3\. Access the Remote Control

Open your web browser and navigate to:

`http://<Your_Docker_Host_IP>:5020`

Replace `<Your_Docker_Host_IP>` with the IP address of the machine running Docker (e.g., `localhost` if running on the same machine, or `192.168.86.10` for a common local network IP).

## Usage

1.  **Select a Client:** Choose a Channels App client device from the "Configured Clients" dropdown to control its playback.
2.  **Select a DVR Server:** Choose a Channels DVR Server from the "Select Channels DVR Server" dropdown to browse its content.
3.  **Control Playback:** Use the "Playback Controls" buttons for basic actions (Play/Pause, Stop, Mute, Channel Up/Down, Seek, etc.).
4.  **Browse Content:**
      * Click "Load Movies" to view recorded movies, then click "Play" on a movie card to play it on the selected client.
      * Click "Load Recent Episodes" to view recent TV show recordings, then click "Play Episode" on an episode card to play it.
5.  **View Status:** Click "Refresh Status" under "Current Device Status" to see what's currently playing on the selected client.
6.  **Customize:** Select a theme from the "Select Theme" dropdown. Toggle "Show Status Notifications" as desired.

## Future Enhancements

  * More advanced DVR management features (e.g., scheduling recordings, deleting content).
  * Further UI/UX improvements.
  * Automated Channels App client and DVR server discovery.
