require('dotenv').config();
const CachingProxyServer = require('./server');

const args = process.argv.slice(2);

if (args[0] === 'clear-cache') {
    const port = process.env.PORT || 3000;
    const origin = process.env.ORIGIN || 'http://localhost';
    const server = new CachingProxyServer(port, origin);
    server.clearCache();
    process.exit(0);
}

const portIdx = args.indexOf('--port');
const originIdx = args.indexOf('--origin');

const port = portIdx !== -1 ? args[portIdx + 1] : (process.env.PORT || 3000);
const origin = originIdx !== -1 ? args[originIdx + 1] : process.env.ORIGIN;

if (!origin) {
    console.error('Origin is required. Pass --origin <url> or set ORIGIN in .env');
    process.exit(1);
}

const server = new CachingProxyServer(port, origin);
server.start();
