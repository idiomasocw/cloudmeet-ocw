# Simple Start Guide (Git Bash)

## Quick Start - 2 Commands

### Terminal 1: Start Backend Services

```bash
docker-compose up
```

### Terminal 2: Start Frontend

```bash
cd livekit-meet-frontend
pnpm dev
```

That's it! Access your app at http://localhost:3000

---

## Alternative: Use the Script

### Terminal 1: Backend

```bash
docker-compose up
```

### Terminal 2: Frontend

```bash
chmod +x start-frontend.sh
./start-frontend.sh
```

---

## What's Running

| Service          | Port    | Command                                |
| ---------------- | ------- | -------------------------------------- |
| Backend Services | Various | `docker-compose up`                    |
| Frontend         | 3000    | `cd livekit-meet-frontend && pnpm dev` |

---

## Stop Everything

**Stop Backend:**

```bash
# Press Ctrl+C in Terminal 1, then:
docker-compose down
```

**Stop Frontend:**

```bash
# Press Ctrl+C in Terminal 2
```

---

## Troubleshooting

### "pnpm: command not found"

```bash
npm install -g pnpm
```

### Port 3000 already in use

```bash
# Find and kill the process
netstat -ano | grep :3000
# Or just use a different port:
cd livekit-meet-frontend
PORT=3001 pnpm dev
```

### Frontend can't connect to backend

Make sure backend is running:

```bash
curl http://localhost:3001/health
```

---

## That's All!

No complicated scripts, no PowerShell, just:

1. `docker-compose up` (backend)
2. `cd livekit-meet-frontend && pnpm dev` (frontend)

Done! 🎉
