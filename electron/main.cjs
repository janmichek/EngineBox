const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

let mainWindow = null;
let serverProcess = null;

const SERVER_PORT = 8787;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

function getServerDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app.asar.unpacked");
  }
  return path.join(__dirname, "..");
}

function getNode() {
  if (process.platform === "darwin") {
    const candidates = [
      process.execPath,
      "/usr/local/bin/node",
      "/opt/homebrew/bin/node",
    ];
    const fs = require("fs");
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {}
    }
  }
  return process.execPath;
}

function waitForServer(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error("Server did not start in time"));
          } else {
            setTimeout(check, 300);
          }
        });
    };
    check();
  });
}

function startServer() {
  const serverDir = getServerDir();
  const node = getNode();
  const serverScript = path.join(serverDir, "server.js");

  serverProcess = spawn(node, [serverScript], {
    cwd: serverDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(d));
  serverProcess.stderr.on("data", (d) => process.stderr.write(d));

  serverProcess.on("error", (err) => {
    console.error("Failed to start server:", err.message);
  });

  serverProcess.on("exit", (code) => {
    console.log(`Server exited with code ${code}`);
    serverProcess = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 800,
    title: "EngineBox",
    icon: path.join(__dirname, "icon.icns"),
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(SERVER_URL);
}

function killServer() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  startServer();

  try {
    await waitForServer(SERVER_URL);
  } catch (err) {
    console.error(err.message);
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  killServer();
  app.quit();
});

app.on("before-quit", () => {
  killServer();
});
