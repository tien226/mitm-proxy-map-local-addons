const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const BACKEND_PORT = 6789;
let backendProcess = null;
let mainWindow = null;

function getProjectRoot() {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return path.resolve(__dirname, "../../..");
}

function getBackendExecutable() {
  if (app.isPackaged) {
    const bundled = path.join(process.resourcesPath, "tft-proxy-backend");
    if (process.platform === "win32") {
      return `${bundled}.exe`;
    }
    return bundled;
  }
  return null;
}

function getPythonExecutable() {
  const venvPython = path.join(getProjectRoot(), ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }
  return process.platform === "win32" ? "python" : "python3";
}

function getBackendDir() {
  return path.join(getProjectRoot(), "app", "backend");
}

function waitForBackend(maxAttempts) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tryOnce = () => {
      const request = http.get(
        `http://127.0.0.1:${BACKEND_PORT}/api/health`,
        (response) => {
          response.resume();
          if (response.statusCode === 200) {
            resolve();
            return;
          }
          scheduleRetry();
        }
      );
      request.on("error", scheduleRetry);
      request.setTimeout(1500, () => {
        request.destroy();
        scheduleRetry();
      });
    };
    const scheduleRetry = () => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        reject(new Error("Backend did not become ready"));
        return;
      }
      setTimeout(tryOnce, 300);
    };
    tryOnce();
  });
}

function startBackend() {
  const projectRoot = getProjectRoot();
  const env = {
    ...process.env,
    TFT_PROXY_PROJECT_ROOT: projectRoot,
  };
  const bundledExecutable = getBackendExecutable();
  if (bundledExecutable !== null) {
    if (!fs.existsSync(bundledExecutable)) {
      console.error("Bundled backend missing:", bundledExecutable);
      return;
    }
    backendProcess = spawn(bundledExecutable, [], {
      stdio: "inherit",
      env,
    });
    return;
  }
  const backendDir = getBackendDir();
  const pythonCommand = getPythonExecutable();
  backendProcess = spawn(
    pythonCommand,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
    {
      cwd: backendDir,
      stdio: "inherit",
      env,
    }
  );
  backendProcess.on("error", (error) => {
    console.error("Failed to start backend:", error.message);
  });
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
  const isDev = process.env.TFT_PROXY_ELECTRON_DEV === "1";
  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}`);
  }
}

async function bootstrap() {
  const shouldStartBackend = !process.env.TFT_PROXY_SKIP_BACKEND;
  if (shouldStartBackend) {
    startBackend();
    await waitForBackend(80);
  } else {
    await waitForBackend(40);
  }
  createWindow();
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error(error);
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrap().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
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
