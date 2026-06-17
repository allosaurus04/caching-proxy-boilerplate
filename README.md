# Caching Proxy Boilerplate

A minimal KV caching proxy server in two ways either NodeCache library or Redis. Pick either folder, and `npm install`.

```
kv-cache-proxy/
├── nodecache/   — in-process cache via node-cache (no extra services)
└── redis/       — distributed cache via Redis with LRU eviction + concurrency lock
```

---

## Quick start

### node-cache version

```bash
cd nodecache
npm install
node index.js --port 3000 --origin http://dummyjson.com
```

### Redis version

```bash
cd redis
docker-compose up -d   # starts Redis on localhost:6379
npm install
node index.js --port 3000 --origin http://dummyjson.com
```

---

## What to change

These are the knobs meant to be adjusted per project. Copy `.env.example` to `.env` and edit:

| Variable | Default | What it does |
|---|---|---|
| `ORIGIN` | _(required)_ | The upstream server to proxy to |
| `PORT` | `3000` | Port this proxy listens on |
| `TTL` | `3600` | Cache entry lifetime in seconds |
| `MAX_CACHE_ITEMS` | `100` | Max cached URLs before LRU evicts oldest |
| `REDIS_HOST` | `localhost` | Redis hostname (redis version only) |
| `REDIS_PORT` | `6379` | Redis port (redis version only) |

You can also pass `--port` and `--origin` as CLI flags; they take precedence over `.env`.

---

## Usage

```bash
node index.js --port <number> --origin <url>
```

A request to `http://localhost:3000/products` is forwarded to `<ORIGIN>/products`.

### Response headers

| Header | Value | Meaning |
|---|---|---|
| `X-Cache` | `HIT` | Served from cache |
| `X-Cache` | `MISS` | Fetched from origin and cached |

### Clearing the cache

```bash
node index.js clear-cache
```

---

## Implementations at a glance

| | nodecache | redis |
|---|---|---|
| Storage | In-process memory | External Redis |
| LRU eviction | Via `maxKeys` option | Manual (in-process list) |
| Concurrency control | None | SET NX lock per URL |
| Extra services | None | Redis (docker-compose provided) |
