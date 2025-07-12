from flask import Flask, render_template, request, jsonify
from pychannels import Channels
import os
import requests
import json
from datetime import datetime

app = Flask(__name__)

# Configuration for Channels App client and Channels DVR Server ports
CHANNELS_APP_PORT = 57000 # Standard Channels App API port
CHANNELS_DVR_SERVER_PORT = 8089 # Standard Channels DVR Server API port - This will be used as a fallback or if not explicitly provided per server

# --- Channels DVR Server IPs Configuration ---
# Format: "IP1:Port1,IP2:Port2,..."
CHANNELS_DVR_SERVERS_STR = os.environ.get('CHANNELS_DVR_SERVERS')
CHANNELS_DVR_SERVERS = []
DVR_SERVERS_CONFIGURED = False

if CHANNELS_DVR_SERVERS_STR:
    try:
        for server_pair in CHANNELS_DVR_SERVERS_STR.split(','):
            ip, port = server_pair.strip().split(':')
            CHANNELS_DVR_SERVERS.append({"ip": ip.strip(), "port": int(port.strip())})
        if CHANNELS_DVR_SERVERS:
            DVR_SERVERS_CONFIGURED = True
    except Exception as e:
        print(f"ERROR: Could not parse CHANNELS_DVR_SERVERS environment variable: {e}")
        CHANNELS_DVR_SERVERS = []
        DVR_SERVERS_CONFIGURED = False

# --- Fallback for DVR server IP if not explicitly configured ---
if not DVR_SERVERS_CONFIGURED:
    print("WARNING: CHANNELS_DVR_SERVERS environment variable not set or incorrectly formatted.")
    print("Please set CHANNELS_DVR_SERVERS to 'IP1:Port1,IP2:Port2,...'.")

# New: Function to discover clients from a given DVR server
def discover_clients_from_dvr(dvr_server_ip, dvr_server_port):
    clients_list = []
    clients_info_url = f"http://{dvr_server_ip}:{dvr_server_port}/dvr/clients/info"
    
    print(f"INFO: Attempting to discover Channels App clients from DVR server at {clients_info_url}")
    try:
        response = requests.get(clients_info_url, timeout=5) # Add a timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        raw_clients_data = response.json()
        
        for client_data in raw_clients_data:
            if 'hostname' in client_data and 'local_ip' in client_data and 'platform' in client_data:
                platform = client_data['platform']
                
                is_phone_or_tablet = False
                if platform.startswith("Android ") and not platform.startswith("AndroidTV "):
                    is_phone_or_tablet = True
                if platform.startswith("iOS") or platform.startswith("iPadOS"):
                    is_phone_or_tablet = True
                if platform.startswith("Fire Tablets"):
                    is_phone_or_tablet = True
                
                if not is_phone_or_tablet:
                    clients_list.append({
                        "name": client_data['hostname'],
                        "ip": client_data['local_ip']
                    })
        return clients_list

    except requests.exceptions.Timeout:
        print(f"ERROR: Timeout connecting to DVR server at {clients_info_url} for client discovery.")
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Could not fetch Channels App client info from DVR server ({clients_info_url}): {e}")
    except json.JSONDecodeError:
        print(f"ERROR: Failed to decode JSON response from DVR server at {clients_info_url}.")
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during client discovery: {e}")
    return []

# Initialize CHANNELS_CLIENTS (for initial page load)
CHANNELS_CLIENTS = []
CLIENTS_CONFIGURED = False

if CHANNELS_DVR_SERVERS:
    # Use the IP and Port of the first configured DVR server to discover clients for initial load
    first_dvr_server_ip = CHANNELS_DVR_SERVERS[0]['ip']
    first_dvr_server_port = CHANNELS_DVR_SERVERS[0].get('port', CHANNELS_DVR_SERVER_PORT)
    CHANNELS_CLIENTS = discover_clients_from_dvr(first_dvr_server_ip, first_dvr_server_port)
    if CHANNELS_CLIENTS:
        CLIENTS_CONFIGURED = True
    else:
        print("WARNING: No eligible Channels App clients found for the first configured DVR server.")
else:
    print("WARNING: No Channels DVR Server configured, so initial client discovery is not possible.")


@app.route('/')
def index():
    # Pass the list of clients, the new flag, and DVR server list to the template
    return render_template('index.html', 
                           clients=CHANNELS_CLIENTS, 
                           clients_configured=CLIENTS_CONFIGURED,
                           dvr_servers=CHANNELS_DVR_SERVERS, # Pass list of DVR servers
                           dvr_servers_configured=DVR_SERVERS_CONFIGURED)

# New API endpoint to dynamically fetch clients for a selected DVR server
@app.route('/dvr_clients', methods=['GET'])
def get_dvr_clients():
    dvr_server_ip = request.args.get('dvr_server_ip')
    dvr_server_port = request.args.get('dvr_server_port', CHANNELS_DVR_SERVER_PORT)

    if not dvr_server_ip:
        return jsonify({"status": "error", "message": "No DVR Server IP provided for client discovery."}), 400

    try:
        clients = discover_clients_from_dvr(dvr_server_ip, int(dvr_server_port))
        if clients:
            return jsonify({"status": "success", "clients": clients})
        else:
            return jsonify({"status": "success", "clients": [], "message": "No eligible clients found for this DVR server."})
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error fetching clients from DVR server: {str(e)}"}), 500

@app.route('/control', methods=['POST'])
def control_channels():
    data = request.json
    target_device_ip = data.get('device_ip')
    action = data.get('action')
    value = data.get('value')
    seek_amount = data.get('seek_amount')
    recording_id = data.get('recording_id')

    if not target_device_ip:
        return jsonify({"status": "error", "message": "No target device IP provided."}), 400

    # For control actions, still validate against currently selected client from UI (which might have been dynamically updated)
    # The important part is that the frontend will only send IPs that were presented in its dropdown.
    # No server-side validation against a global CHANNELS_CLIENTS list is needed here, as the frontend ensures validity.

    try:
        if action == 'play_recording':
            if recording_id:
                play_api_url = f"http://{target_device_ip}:{CHANNELS_APP_PORT}/api/play/recording/{recording_id}"
                try:
                    response = requests.post(play_api_url)
                    response.raise_for_status()
                    return jsonify({"status": "success", "message": f"Sent play command for recording {recording_id} to {target_device_ip}."})
                except requests.exceptions.RequestException as e:
                    return jsonify({"status": "error", "message": f"Error sending play command to Channels App ({target_device_ip}): {e}. Ensure the Channels App is running and reachable, and that it can access your DVR server."}), 500
            else:
                return jsonify({"status": "error", "message": "Recording ID required for playback."}), 400
        else:
            client = Channels(target_device_ip, CHANNELS_APP_PORT)
            if action == 'toggle_pause':
                client.toggle_pause()
            elif action == 'channel_up':
                client.channel_up()
            elif action == 'channel_down':
                client.channel_down()
            elif action == 'previous_channel':
                client.previous_channel()
            elif action == 'play_channel':
                if value:
                    client.play_channel(str(value))
                else:
                    return jsonify({"status": "error", "message": "Channel number required for 'play_channel'."}), 400
            elif action == 'seek':
                if seek_amount is not None:
                    try:
                        seek_seconds = int(seek_amount)
                        client.seek(seek_seconds)
                    except ValueError:
                        return jsonify({"status": "error", "message": "Seek amount must be an integer."}), 400
                else:
                    return jsonify({"status": "error", "message": "Seek amount required for 'seek' action."}), 400
            elif action == 'toggle_mute':
                client.toggle_mute()
            elif action == 'stop':
                client.stop()
            elif action == 'toggle_cc':
                client.toggle_cc()
            elif action == 'navigate':
                if value:
                    client.navigate(value)
                else:
                    return jsonify({"status": "error", "message": "Section name required for 'navigate'."}), 400
            else:
                return jsonify({"status": "error", "message": "Invalid action"}), 400

        return jsonify({"status": "success", "message": f"Action '{action}' executed on {target_device_ip}."})

    except Exception as e:
        return jsonify({"status": "error", "message": f"Error controlling Channels App ({target_device_ip}): {e}"}), 500

@app.route('/channels_list', methods=['GET'])
def get_channels_list():
    target_device_ip = request.args.get('device_ip')

    if not target_device_ip:
        return jsonify({"status": "error", "message": "No target device IP provided for channel list."}), 400

    try:
        favorite_channels_url = f"http://{target_device_ip}:{CHANNELS_APP_PORT}/api/favorite_channels"
        response = requests.get(favorite_channels_url)
        response.raise_for_status()
        favorite_channels_data = response.json()

        channels_for_gui = []
        for channel in favorite_channels_data:
            if 'number' in channel and 'name' in channel:
                channels_for_gui.append({
                    "channel_number": channel['number'],
                    "name": channel['name']
                })

        channels_for_gui.sort(key=lambda x: float(x['channel_number']))

        return jsonify(channels_for_gui)
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Error fetching favorite channels from {target_device_ip}: {e}. Is the app running on this device?"}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred during channel list fetch: {e}"}), 500

@app.route('/status', methods=['GET'])
def get_status():
    target_device_ip = request.args.get('device_ip')

    if not target_device_ip:
        return jsonify({"status": "error", "message": "No target device IP provided for status."}), 400

    try:
        client = Channels(target_device_ip, CHANNELS_APP_PORT)
        status = client.status()
        return jsonify(status)
    except Exception as e:
        error_message = f"Error fetching status from {target_device_ip}: {str(e)}"
        print(f"DEBUG: Exception in /status route: {error_message}")
        return jsonify({"status": "error", "message": error_message}), 500

@app.route('/dvr_movies', methods=['GET'])
def get_dvr_movies():
    """
    Fetches a list of all movies from the Channels DVR Server API for a given IP.
    Supports sorting based on API parameters.
    """
    dvr_server_ip = request.args.get('dvr_server_ip')
    dvr_server_port = request.args.get('dvr_server_port', CHANNELS_DVR_SERVER_PORT)
    sort_by = request.args.get('sort_by', 'date_released')
    sort_order = request.args.get('sort_order', 'desc')

    if not dvr_server_ip:
        return jsonify({"status": "error", "message": "No DVR Server IP provided."}), 400

    dvr_server_url = f"http://{dvr_server_ip}:{dvr_server_port}"
    movies_api_url = f"{dvr_server_url}/api/v1/movies?sort={sort_by}&order={sort_order}"

    try:
        response = requests.get(movies_api_url)
        response.raise_for_status()
        raw_movies = response.json()

        processed_movies = []
        for movie in raw_movies:
            if 'title' in movie and 'id' in movie:
                release_timestamp = 0
                release_year = None
                if movie.get('release_date'):
                    try:
                        dt_object = datetime.strptime(movie['release_date'], '%Y-%m-%d')
                        release_timestamp = int(dt_object.timestamp())
                        release_year = dt_object.year
                    except ValueError:
                        pass

                processed_movies.append({
                    "id": movie['id'],
                    "title": movie.get('title'),
                    "episode_title": movie.get('episode_title'), 
                    "summary": movie.get('summary'),
                    "duration": movie.get('duration'),
                    "air_date": release_timestamp,
                    "release_year": release_year,
                    "channel_call_sign": movie.get('channel'),
                    "image_url": movie.get('image_url'),
                    "series_id": None
                })
        
        return jsonify({"status": "success", "movies": processed_movies})
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Error connecting to Channels DVR Server at {dvr_server_url}: {e}. Is the server running and reachable and is /api/v1/movies the correct endpoint with provided sort/order?"}), 500
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": f"Failed to parse JSON response from DVR server at {movies_api_url}."}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred while fetching DVR movies: {e}"}), 500

@app.route('/dvr_shows', methods=['GET'])
def get_dvr_shows():
    """
    Fetches a list of all TV show episodes from the Channels DVR Server API for a given IP.
    Supports sorting based on API parameters.
    """
    dvr_server_ip = request.args.get('dvr_server_ip')
    dvr_server_port = request.args.get('dvr_server_port', CHANNELS_DVR_SERVER_PORT)
    sort_by = request.args.get('sort_by', 'date_aired')
    sort_order = request.args.get('sort_order', 'desc')

    if not dvr_server_ip:
        return jsonify({"status": "error", "message": "No DVR Server IP provided."}), 400

    dvr_server_url = f"http://{dvr_server_ip}:{dvr_server_port}"
    episodes_api_url = f"{dvr_server_url}/api/v1/episodes?sort={sort_by}&order={sort_order}"

    try:
        response = requests.get(episodes_api_url)
        response.raise_for_status()
        raw_episodes = response.json()

        processed_episodes = []
        for episode in raw_episodes:
            if 'id' in episode and 'title' in episode:
                air_timestamp = 0
                if episode.get('original_air_date'):
                    try:
                        dt_object = datetime.strptime(episode['original_air_date'], '%Y-%m-%d')
                        air_timestamp = int(dt_object.timestamp())
                    except ValueError:
                        pass
                
                created_at_timestamp = 0
                if episode.get('created_at'):
                    try:
                        created_at_timestamp = int(episode['created_at'] / 1000)
                    except (ValueError, TypeError):
                        pass

                processed_episodes.append({
                    "id": episode['id'],
                    "show_title": episode.get('title'),
                    "episode_title": episode.get('episode_title'),
                    "season_number": episode.get('season_number'),
                    "episode_number": episode.get('episode_number'),
                    "summary": episode.get('summary'),
                    "duration": episode.get('duration'),
                    "air_date": air_timestamp,
                    "channel_call_sign": episode.get('channel'),
                    "image_url": episode.get('image_url'),
                    "date_added": created_at_timestamp
                })
        
        return jsonify({"status": "success", "episodes": processed_episodes})
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Error connecting to Channels DVR Server at {dvr_server_url}: {e}. Is the server running and reachable and is /api/v1/episodes the correct endpoint?"}), 500
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": f"Failed to parse JSON response from DVR server at {episodes_api_url}."}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred while fetching DVR shows: {e}"}), 500

# New: Route to send notifications
@app.route('/send_notification', methods=['POST'])
def send_notification():
    data = request.get_json()
    client_id = data.get('client_id')
    title = data.get('title', '')
    message = data.get('message', '')

    if not client_id:
        return jsonify({'status': 'error', 'message': 'Client ID is required.'}), 400

    # Channels DVR client API endpoint for notifications. Corrected to use CHANNELS_APP_PORT (57000) and /api/notify endpoint.
    notification_url = f"http://{client_id}:{CHANNELS_APP_PORT}/api/notify"

    payload = {
        "title": title,
        "message": message
    }

    try:
        response = requests.post(notification_url, json=payload, timeout=5)
        response.raise_for_status() # Raise an exception for HTTP errors

        return jsonify({'status': 'success', 'message': 'Notification sent.'})
    except requests.exceptions.ConnectionError:
        return jsonify({'status': 'error', 'message': f'Could not connect to client {client_id}. Make sure Channels DVR is running and accessible.'}), 500
    except requests.exceptions.Timeout:
        return jsonify({'status': 'error', 'message': 'Request to Channels DVR client timed out.'}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({'status': 'error', 'message': f'Error sending notification: {e}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {e}'}), 500

@app.route('/collections_list', methods=['GET'])
def get_collections_list():
    dvr_server_ip = request.args.get('dvr_server_ip')
    dvr_server_port = request.args.get('dvr_server_port', CHANNELS_DVR_SERVER_PORT)

    if not dvr_server_ip:
        return jsonify({"status": "error", "message": "No DVR Server IP provided."}), 400

    collections_api_url = f"http://{dvr_server_ip}:{dvr_server_port}/dvr/collections/channels"
    
    try:
        response = requests.get(collections_api_url, timeout=5)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        return jsonify(response.json())
    except requests.exceptions.Timeout:
        return jsonify({"status": "error", "message": f"Timeout connecting to DVR server at {dvr_server_ip}:{dvr_server_port} for collections."}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Error fetching collections from DVR server ({dvr_server_ip}:{dvr_server_port}): {e}"}), 500
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": f"Failed to decode JSON response from DVR server at {collections_api_url}."}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred while fetching collections: {e}"}), 500

@app.route('/now_playing_data', methods=['GET'])
def get_now_playing_data():
    dvr_server_ip = request.args.get('dvr_server_ip')
    dvr_server_port = request.args.get('dvr_server_port', CHANNELS_DVR_SERVER_PORT)

    if not dvr_server_ip:
        return jsonify({"status": "error", "message": "No DVR Server IP provided."}), 400

    now_playing_api_url = f"http://{dvr_server_ip}:{dvr_server_port}/devices/ANY/guide/now"
    
    try:
        response = requests.get(now_playing_api_url, timeout=5)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        return jsonify(response.json())
    except requests.exceptions.Timeout:
        return jsonify({"status": "error", "message": f"Timeout connecting to DVR server at {dvr_server_ip}:{dvr_server_port} for now playing data."}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({"status": "error", "message": f"Error fetching now playing data from DVR server ({dvr_server_ip}:{dvr_server_port}): {e}"}), 500
    except json.JSONDecodeError:
        return jsonify({"status": "error", "message": f"Failed to decode JSON response from DVR server at {now_playing_api_url}."}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred while fetching now playing data: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)