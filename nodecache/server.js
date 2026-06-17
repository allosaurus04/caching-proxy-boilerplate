const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

const TTL = parseInt(process.env.TTL) || 3600;
const MAX_CACHE_ITEMS = parseInt(process.env.MAX_CACHE_ITEMS) || 100;

class CachingProxyServer {
    constructor(port, origin) {
        this.port = port;
        this.origin = origin;
        this.cache = new NodeCache({ stdTTL: TTL, maxKeys: MAX_CACHE_ITEMS });
        this.app = express();
    }

    buildUrl(path) {
        return `${this.origin}${path}`;
    }

    async handleRequest(req, res) {
        const url = this.buildUrl(req.originalUrl);

        const cached = this.cache.get(url);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            const { status, data } = cached;
            return res.status(status).send(data);
        }

        try {
            const response = await axios.get(url);
            this.cache.set(url, { status: response.status, data: response.data });
            res.setHeader('X-Cache', 'MISS');
            res.status(response.status).send(response.data);
        } catch (error) {
            const status = error.response?.status || 500;
            res.status(status).send(error.message);
        }
    }

    start() {
        this.app.get('*', this.handleRequest.bind(this));
        this.app.listen(this.port, () => {
            console.log(`Caching proxy running on port ${this.port}`);
        });
    }

    clearCache() {
        this.cache.flushAll();
        console.log('Cache cleared');
    }
}

module.exports = CachingProxyServer;
