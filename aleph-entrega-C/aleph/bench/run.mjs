// Ejecuta bench/index.html en Chromium sin interfaz. Requiere `playwright` (no es dependencia del proyecto).
import { createServer } from 'vite';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.error('Instala playwright para ejecutar el benchmark: npm i -D playwright'); process.exit(1); }

const n = process.argv[2] ?? '10000';
const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(`http://localhost:5199/bench/index.html?n=${n}`);
await page.waitForFunction('window.__bench || window.__benchError', null, { timeout: 280_000 });
const err = await page.evaluate('window.__benchError');
if (err) { console.error(err); process.exitCode = 1; }
else console.log(JSON.stringify(await page.evaluate('window.__bench'), null, 2));
await browser.close();
await server.close();
