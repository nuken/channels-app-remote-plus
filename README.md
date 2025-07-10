# **Channels DVR Remote Plus**

**Channels DVR Remote Plus** provides a web-based remote control for your Channels DVR client apps (e.g., Apple TV, Fire TV, Google TV). It offers enhanced integration with your Channels DVR Server, enabling browsing and playback of recorded content — all optimized for mobile and designed with intuitive simplicity.

---

## 🚫 Limitations

- **No D-pad Controls:** This app doesn't provide generic “Up/Down/Left/Right” navigation within Channels clients. It focuses on direct playback and targeted navigation.
- **Local Network Use Only:** Built for speed and privacy, this remote is intended to run exclusively on your local network.

---

## 🎯 Features

- **Client Control:** Instantly switch between Channels app clients on your network.
- **Multi-DVR Support:** Configure and toggle between multiple DVR servers.
- **Auto Discovery:** Finds Channels clients from configured DVRs (excluding phones/tablets).
- **Playback Tools:** Use Play/Pause, Stop, Mute, Closed Captions (CC), and CC/Mute toggle.
- **Channel Surfing:** Jump to Previous, Channel Up/Down, or tune to specific channels — plus easy access to favorite channels.
- **Smart Seek:** Jump forward/backward with custom step sizes.
- **Direct App Navigation:** Switch to Live TV, Guide, Library, or Search in one tap.
- **Browse DVR Movies:** Search, sort, and play recorded films from the DVR server.
- **Browse Recent TV Episodes:** Quickly find and launch recent recordings.
- **Now Playing Status:** See real-time playback info for the selected client.
- **Toggleable Notifications:** Choose whether to show in-app action notifications.
- **Responsive UI:** Fully optimized for phones, tablets, and desktops.
- **Custom Themes:** Switch between light/dark themes to match your style.

---

## 🐳 Installation

This app is distributed as a multi-architecture Docker image (`linux/amd64` and `linux/arm64/v8`).

### 1. Pull the Image
```bash
docker pull rcvaughn2/channels-remote-plus
```

### 2. Run the Container

Set the `CHANNELS_DVR_SERVERS` environment variable with a comma-separated list of `IP:Port` pairs. No spaces around commas or colons.

**Example:**
```bash
docker run -d --restart unless-stopped \
  -p 5020:5000 \
  -e "CHANNELS_DVR_SERVERS=192.168.86.64:8089,192.168.1.100:8090" \
  --name channels-remote \
  rcvaughn2/channels-remote-plus
```

> Replace `5020` with any preferred host port, and update IPs/Ports per your local setup.

Using Hostnames: You can use local hostnames (e.g., media-server8:8089) instead of IP addresses if your Docker environment is configured to resolve them. For containers running in default bridge mode, you might need to use the --add-host flag (e.g., --add-host media-server8:192.168.1.50) or configure Docker to use a local DNS server that can resolve these names.

---

## 🌐 Access the App

Once running, access the remote via:

```
http://<Your_Docker_Host_IP>:5020
```

For example, use `localhost` or `192.168.x.x` depending on your environment.

---

## 🕹️ Usage

1. **Choose a Client:** Pick from detected Channels client devices.
2. **Select DVR Server:** Switch between DVR sources to browse content.
3. **Control Playback:** Use intuitive controls for play, stop, mute, and more.
4. **Browse Content:**
   - **Movies:** Load → Search → Sort → Play.
   - **Recent TV:** Load → Filter → Play.
5. **Monitor Playback:** Refresh for live Now Playing data.
6. **Customize Appearance:** Switch themes and toggle status notifications.

---

## 🚧 Roadmap

- Add DVR scheduling, pass management, and deletion tools.
- Improve UI/UX with additional customization options.
- Integrate deeper client controls (e.g., volume, finer navigation).

---
