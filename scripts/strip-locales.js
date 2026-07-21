const fs = require("fs");
const path = require("path");

module.exports = async function (context) {
  if (context.electronPlatformName !== "darwin") return;

  let freed = 0;

  const apps = fs.readdirSync(context.appOutDir).filter(f => f.endsWith(".app"));
  for (const app of apps) {
    const dirs = [
      path.join(context.appOutDir, app, "Contents", "Resources"),
      path.join(context.appOutDir, app, "Contents", "Frameworks", "Electron Framework.framework", "Versions", "A", "Resources"),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      for (const entry of fs.readdirSync(dir)) {
        if (entry.endsWith(".lproj") && entry !== "en.lproj" && entry !== "en-US.lproj") {
          const p = path.join(dir, entry);
          freed += fs.statSync(p).size;
          fs.rmSync(p, { recursive: true, force: true });
        }
      }
    }
  }

  console.log(`Stripped locales: freed ~${(freed / 1024 / 1024).toFixed(1)} MB`);
};
