# Channels DVR Simple Remote Control

This is a basic, dockerized web-based remote control for your Channels DVR client apps (e.g., Apple TV, Fire TV). It's designed for simple control and mobile use.

**Note:** This is a work in progress. Future updates may include integration with the Channels DVR *Server* API (port 8089) for content Browse and DVR management.

## Limitations

* **No Content Browse:** Does not list or browse your recorded shows or guide data. It only controls playback on the Channels app client.
* **No DVR Server Interaction:** Communicates only with the Channels *App* client (port 57000), not the DVR server itself.
* **No Generic UI Navigation:** Does not provide "Up, Down, Left, Right" D-pad controls for general app navigation.
* **Local Network Only:** For security, it's intended for use only within your local network.

## Features

* **Multi-Client Control:** Select and control different Channels app clients.
* **Basic Playback:** Play/Pause, Stop, Mute.
* **Channel Control:** Channel Up/Down, Previous Channel, Manual channel entry, Tune to favorite channels (fetched from the client).
* **Adjustable Seek:** Jump forward/backward by custom seconds.
* **App Navigation:** Go directly to Live TV, Guide, Library, or Search sections.
* **Real-time Status:** View current playback status.
* **Toggle Notifications:** Enable/disable status pop-up notifications (off by default).
* **Mobile-Friendly:** Responsive design for various screen sizes.

## Installation

This remote is deployed as a Docker image.

### 1. Pull the Docker Image
```
docker pull rcvaughn2/channels-app-remote
```

### 2. Run the Docker Container

Provide your Channels App client devices as a comma-separated list of `Name:IP` pairs using the `CHANNELS_APP_CLIENTS` environment variable. Ensure no spaces around commas or colons.

**Example Command:**
```
docker run -d --restart unless-stopped

-p 5010:5000

-e "CHANNELS_APP_CLIENTS=Family Room TV:192.168.86.35,Master TV:192.168.86.21,Front Door TV:192.168.86.60"

--name dvr-remote

rcvaughn2/channels-app-remote
```

* `-d`: Run in detached mode.
* `--restart unless-stopped`: Restart automatically on Docker daemon start.
* `-p 5010:5000`: Maps host port 5010 to container port 5000 (change 5010 if needed).
* `-e CHANNELS_APP_CLIENTS="..."`: Your client names and IPs.
* `--name dvr-remote`: Assigns a name to the container.

### 3. Access the Remote Control

Open your web browser and navigate to:

`http://<Your_Docker_Host_IP>:5010`

Replace `<Your_Docker_Host_IP>` with the IP of your Docker machine (e.g., `localhost` or `192.168.86.10`).

## Usage

1.  Select a client from the dropdown.
2.  Use buttons to control playback, channels, seek, and app navigation.
3.  Refresh favorite channels or status as needed.
4.  Toggle notifications for pop-ups.

## Future Enhancements

* Channels DVR Server API integration (content Browse, management).
* UI/UX improvements.
* Automated client discovery.
