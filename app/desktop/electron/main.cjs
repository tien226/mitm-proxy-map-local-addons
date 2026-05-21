const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const BACKEND_PORT = 6789;
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
let backendProcess = null;
let mainWindow = null;

function startBackend() {
  const pythonCommand = process.platform === "win32" ? "python" : "python3";
  backendProcess = spawn(
    pythonCommand,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    {
      cwd: path.join(PROJECT_ROOT, "app/backend"),
      stdio: "inherit",
    }
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "TFT Proxy",
    backgroundColor: "#1a1d23",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
    },
  });
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
  }
}

app.whenReady().then(() => {
  if (!process.env.TFT_PROXY_SKIP_BACKEND) {
    startBackend();
  }
  setTimeout(createWindow, 1200);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess !== null) {
    backendProcess.kill();
  }
});
