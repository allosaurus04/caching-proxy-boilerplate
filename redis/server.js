const express = require('express');
const https = require('https');
const http = require('http');
const Redis = require('ioredis');

const TTL = parseInt(process.env.TTL) || 3600;
const MAX_CACHE_ITEMS = parseInt(process.env.MAX_CACHE_ITEMS) || 100;
const LOCK_TTL = 10;     // seconds a fetch lock is held before auto-expiry
const RETRY_DELAY = 200; // ms to wait before retrying a locked key

class CachingProxyServer {
    constructor(port, origin) {
        this.port = port;
        this.origin = origin;
        this.app = express();
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
        });
        this.lruList = [];
    }

    buildUrl(path) {
        return `${this.origin}${path}`;
    }

    async updateLRU(key) {
        this.lruList = this.lruList.filter(k => k !== key);
        this.lruList.push(key);

        if (this.lruList.length > MAX_CACHE_ITEMS) {
            const evicted = this.lruList.shift();
            await this.redis.del(evicted);
            console.log(`[LRU] evicted: ${evicted}`);
        }
    }

    fetchUrl(urlString) {
        return new Promise((resolve, reject) => {
            const client = urlString.startsWith('https') ? https : http;
            client.get(urlString, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            }).on('error', reject);
        });
    }

    async handleRequest(req, res) {
        const url = this.buildUrl(req.originalUrl);

        const cached = await this.redis.get(url);
        if (cached) {
            await this.updateLRU(url);
            res.setHeader('X-Cache', 'HIT');
            const { status, data } = JSON.parse(cached);
            return res.status(status).send(data);
        }

        const lock = await this.redis.set(`lock:${url}`, '1', 'EX', LOCK_TTL, 'NX');
        if (!lock) {
            await new Promise(r => setTimeout(r, RETRY_DELAY));
            const retried = await this.redis.get(url);
            if (retried) {
                res.setHeader('X-Cache', 'HIT');
                const { status, data } = JSON.parse(retried);
                return res.status(status).send(data);
            }
        }

        try {
            const response = await this.fetchUrl(url);
            await this.redis.set(url, JSON.stringify(response), 'EX', TTL);
            await this.updateLRU(url);
            res.setHeader('X-Cache', 'MISS');
            res.status(response.status).send(response.data);
        } catch (error) {
            res.status(502).send(`Proxy error: ${error.message}`);
        } finally {
            await this.redis.del(`lock:${url}`);
        }
    }

    start() {
        this.app.get('*', this.handleRequest.bind(this));
        this.app.listen(this.port, () => {
            console.log(`Caching proxy running on port ${this.port}`);
        });
    }

    async clearCache() {
        await this.redis.flushall();
        this.lruList = [];
        console.log('Cache cleared');
    }
}

module.exports = CachingProxyServer;
