# MacOS: map local for requests with mitmproxy

Easy map local for request with [mitmproxy](https://mitmproxy.org/)

## TFT Proxy App (Proxyman-style UI)

Use the visual app instead of editing `config.json` by hand:

```bash
chmod +x launch-app.sh open-proxy-app.sh
./launch-app.sh
```

See **[APP_README.md](./APP_README.md)** for full guide.

## Installation

### Prerequisites

- Python 3.7+
- [mitmproxy 6.0+](https://docs.mitmproxy.org/stable/overview-installation/)

### Step-by-Step Installation

1. Install mitmproxy with homebrew

   ```shell
   brew install mitmproxy
   ```

2. Clone this repository:

   ```shell
   git clone https://github.com/quanzen8labs/mitm-proxy-map-local-addons.git
   ```

## Using

The following steps will guide you through the process of using this repository

### Updating `config.json`

The `config.json` file allows you to configure local requests with the following fields:

- `method`: The HTTP method of the request (e.g., GET, POST, PUT).
- `url`: The URL of the request that you want to map to a local file.
- `local_file`: The relative path to the local file that should be served in response to the request.

  Example `config.json`:

  ```json
  [
    {
      "method": "GET",
      "url": "http://api.example1",
      "local_file": "example1.json"
    },
    {
      "method": "POST",
      "url": "https://api.example2",
      "local_file": "example2.json"
    }
  ]
  ```

### Locating Local Files

Your local files, which will be served in response to requests based on the configurations in config.json, should be placed in the "local-files" folder within your project directory.

1. Open the "local-files" folder.
2. Place the local files that correspond to the paths specified in config.json within this folder. The local files should have the same relative path as configured in `local_file`.

### Start mitmproxy

#### Command Line UI

Run script `start.sh`

#### Web UI

Run script `start.sh web`

## Connect to the proxy

### For Android:

1. Open the Wi-Fi settings on your Android device.

2. Connect to the same Wi-Fi network as your Macbook.

3. Long-press the connected Wi-Fi network and select "Modify Network."

4. In the "Advanced Options," set the "Proxy" option to "Manual."

5. Enter the IP address of your Macbook (the one noted earlier) in the "Proxy hostname" field.

6. Enter "8080" in the "Proxy port" field.

7. Save your changes.

### For iOS:

1. Open the "Settings" app on your iOS device.

2. Go to "Wi-Fi" settings. Connect to the same Wi-Fi network as your Macbook.

3. Tap the connected Wi-Fi network.

4. Scroll down and select "Configure Proxy."

5. Choose "Manual."

6. In the "Server" field, enter the IP address of your Macbook (the one noted earlier).

7. In the "Port" field, enter "8080."

8. Save your changes.

## For https requests

### MacOS

Run script `setup.sh` trust mitmproxy certificate

### Mobile Devices

Please follow this section to setup certificates for https requests [Certificates](certificates-setups.md)
