const { app, BrowserWindow, dialog } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

let mainWindow = null;
let staticServer = null;
let appUrl = null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getDistDir() {
  return path.join(app.getAppPath(), "dist");
}

function startStaticServer(distDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const requested = decodeURIComponent(url.pathname);
      const relative = requested === "/" ? "index.html" : requested.replace(/^\//, "");
      const filePath = path.normalize(path.join(distDir, relative));
      const distRoot = path.normalize(distDir) + path.sep;

      if (filePath !== path.normalize(distDir) && !filePath.startsWith(distRoot)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      const servePath =
        fs.existsSync(filePath) && fs.statSync(filePath).isFile()
          ? filePath
          : path.join(distDir, "index.html");

      if (!fs.existsSync(servePath) || !fs.statSync(servePath).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const data = fs.readFileSync(servePath);
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(servePath)] || "application/octet-stream",
        "Content-Length": data.length,
      });
      res.end(data);
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 800,
    title: "EngineBox",
    icon: path.join(__dirname, "icon.icns"),
    titleBarStyle: "hiddenInset",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow) mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(appUrl);
}

function stopServer() {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
}

app.whenReady().then(async () => {
  try {
    const distDir = getDistDir();
    const index = path.join(distDir, "index.html");
    if (!fs.existsSync(index)) {
      throw new Error("UI not found. Run npm run ui:build before launching Electron.");
    }

    const started = await startStaticServer(distDir);
    staticServer = started.server;
    appUrl = started.url;
    createWindow();
  } catch (err) {
    dialog.showErrorBox("EngineBox", err.message);
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && appUrl) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
