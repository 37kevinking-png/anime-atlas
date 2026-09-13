const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.match(app, /service-worker\.js\?v=45/);
assert.match(app, /updateViaCache:\s*"none"/);
assert.match(html, /styles\.css\?v=45/);
assert.match(html, /core\.js\?v=45/);
assert.match(html, /app\.js\?v=45/);

const appShell = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1];
assert.doesNotMatch(appShell, /anime-data\.js/);
assert.doesNotMatch(appShell, /anime-cn-data\.js/);
assert.match(worker, /anime-atlas-shell-v45/);
assert.match(worker, /anime-atlas-data-v1/);

console.log("service worker update strategy tests passed");
