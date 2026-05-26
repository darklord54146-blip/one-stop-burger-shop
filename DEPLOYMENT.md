# Live Deployment

This project is already a full-stack app:

- Frontend: static pages in `public/`
- Backend: Node.js server in `server.js`
- Database: JSON database file, created from `db/seed.json` if missing

## Local Production Run

```powershell
node server.js
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

## Deploy As One Live App

Use any host that supports Docker or Node.js web services. The included `Dockerfile` runs the frontend, backend, and database together.

Recommended setup:

- Build command: none if using Docker
- Start command: `node server.js` if not using Docker
- Port: `3000`, or the host-provided `PORT`
- Persistent database path: set `DB_PATH` to a mounted disk path

For Render-style deployment, this repo includes `render.yaml` with:

- web service
- health check at `/api/health`
- persistent disk mounted at `/data`
- database file at `/data/db.json`

## Important Payment Note

Cash on delivery works as an order status.

Easypaisa and bank transfer are manual verification flows. Customers pay through their own Easypaisa or banking app, then submit only the transaction/reference ID. Real automatic payment capture needs an official merchant gateway/API from Easypaisa or a bank.

Never collect customer PINs, OTPs, banking passwords, or card details in this app.
