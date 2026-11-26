import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--mute-audio'] });
const p = await b.newPage(); const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', (e) => logs.push('PAGEERR ' + e.stack.split('\n').slice(0, 4).join(' | ')));
await p.goto('http://127.0.0.1:8141/?auto=1', { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 6000));
console.log(logs.join('\n') || '(none)'); await b.close();
