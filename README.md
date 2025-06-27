# Channels DVR Remote Plus

This project provides a web-based remote control for your Channels DVR client applications (e.g., Apple TV, Fire TV, Google TV). It now features enhanced integration with your Channels DVR Server, allowing you to browse and play recorded content directly from the remote. The application is designed for simple, intuitive control and is optimized for mobile use.

## **Limitations**

- **No Generic UI Navigation:** This remote does not offer "Up, Down, Left, Right" D-pad controls for general app navigation within the Channels client application itself. It focuses on direct playback and specific section navigation.

- **Local Network Only:** For security and performance, this application is intended for use exclusively within your local network.

## **Features**

- **Multi-Client Control:** Easily select and control different Channels app client devices connected to your network.

- **Multi-DVR Server Support:** Configure and switch between multiple Channels DVR Server installations.

- **Automated Client Discovery:** Channels app clients are automatically discovered from your configured DVR server(s), with automatic filtering to exclude mobile devices (phones/tablets).

- **Basic Playback Controls:** Comprehensive controls for Play/Pause, Stop, Mute, Closed Captions (CC), and a combined CC/Mute toggle.

- **Channel Management:** Navigate channels with Channel Up/Down, jump to the Previous Channel, or manually tune to a specific channel number. You can also load and select from your Channels app client's favorite channels.

- **Adjustable Seek:** Quickly jump forward or backward by custom second increments.

- **Direct App Navigation:** Instantly switch the client app's view to Live TV, Guide, Library, or Search sections.

- **Browse & Play DVR Movies:** Load a list of movies recorded on your Channels DVR Server. Features client-side search by title/summary and sorting by release date, title, or duration. Play movies directly on the selected client.

- **Browse & Play Recent TV Show Episodes:** Load recently recorded TV show episodes from your Channels DVR Server. Includes client-side search by show title, episode title, or summary, and sorting by air date, show title, episode title, date added, or duration. Play episodes directly.

- **Real-time Status:** View the current playback status and "Now Playing" information from the selected Channels app client.

- **Toggle Notifications:** Enable or disable on-screen pop-up notifications for actions and status updates (off by default for mobile-friendly use).

- **Mobile-Friendly Design:** Responsive user interface designed to adapt seamlessly across various screen sizes.

- **Theming Options:** Personalize your experience by selecting from various light and dark themes.

## **Installation**

This remote is primarily deployed as a multi-architecture Docker image, supporting linux/amd64 and linux/arm64/v8.

### **1. Pull the Docker Image**
```
docker pull rcvaughn2/channels-remote-plus
```
### **2. Run the Docker Container**

You must provide your Channels DVR Server(s) as a comma-separated list of Name:IP pairs using the CHANNELS_DVR_SERVERS environment variable. Ensure there are no spaces around commas or colons in the list.

**Example Command:**
```
docker run -d --restart unless-stopped \ \
  -p 5020:5000 \ \
  -e "CHANNELS_DVR_SERVERS=Home DVR:192.168.86.64,Office DVR:192.168.1.100" \ \
  --name channels-remote \ \
  rcvaughn2/channels-remote-plus
```
- -d: Runs the container in detached mode (in the background).

- --restart unless-stopped: Configures the container to restart automatically unless it is explicitly stopped.

- -p 5020:5000: Maps host port 5020 to the container's internal port 5000. You can change 5020 to any available port on your host machine.

- -e "CHANNELS_DVR_SERVERS=...": **Required.** Specifies your Channels DVR Server names and their corresponding IP addresses. This is crucial for the application to discover your Channels app clients and fetch DVR content.

- --name channels-remote: Assigns a convenient name to your Docker container.

### **3. Access the Remote Control**

Once the container is running, open your web browser and navigate to:

[http://<Your_Docker_Host_IP>:5020](null)

Replace <Your_Docker_Host_IP> with the actual IP address of the machine running Docker (e.g., localhost if you're running it on the same machine, or 192.168.86.10 for a common local network IP).

## **Usage**

1. **Select a Client:** Use the "Configured Clients" dropdown to choose the Channels App client device you wish to control. This list is automatically populated from your configured DVR server(s).

2. **Select a DVR Server:** Choose a Channels DVR Server from the "Select Channels DVR Server" dropdown to browse its recorded content (movies and TV shows).

3. **Control Playback:** Utilize the "Playback Controls" buttons for common actions like Play/Pause, Stop, Mute, Channel Up/Down, and Seek.

4. **Browse Content:**

- In the "Movies" section, click "Load Movies" to display your recorded films. You can search by title/summary and sort the list. Click "Play" on a movie card to start playback on the selected client.

- In the "TV Shows (Recent Episodes)" section, click "Load Recent Episodes" to view recently recorded TV show episodes. Search and sort options are also available here. Click "Play Episode" to begin playback.

- **View Status:** Click "Refresh Status" under "Current Device Status" to get real-time information about what's currently playing on the selected client.

- **Customize:** Adjust the application's appearance by selecting a theme from the "Select Theme" dropdown. You can also toggle "Show Status Notifications" on or off based on your preference.

## **Future Enhancements**

- More advanced DVR management features (e.g., scheduling recordings, deleting content, managing passes).

- Further user interface and user experience improvements.

- Enhanced client interaction, potentially including volume control or more granular navigation.
