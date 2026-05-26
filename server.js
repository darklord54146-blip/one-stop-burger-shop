const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "db", "db.json");
const SEED_PATH = path.join(ROOT, "db", "seed.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    const seed = await fs.readFile(SEED_PATH, "utf8");
    await fs.writeFile(DB_PATH, seed);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": MIME[".json"] });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function money(amount) {
  return Number(amount || 0);
}

function validatePayment(method) {
  return ["cash", "easypaisa", "bank"].includes(method);
}

function cleanReference(value) {
  return String(value || "").replace(/[^a-zA-Z0-9-_.]/g, "").slice(0, 40);
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = await readDb();

  if (req.method === "GET" && url.pathname === "/api/site") {
    return sendJson(res, 200, {
      restaurant: db.restaurant,
      menu: db.menu,
      paymentOptions: db.paymentOptions,
      featuredReviews: db.featuredReviews
    });
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "One Stop Burger Shop",
      database: path.basename(DB_PATH),
      time: new Date().toISOString()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/menu") {
    return sendJson(res, 200, db.menu);
  }

  if (req.method === "POST" && url.pathname === "/api/reservations") {
    const data = await readBody(req);
    const required = ["name", "phone", "date", "time", "guests"];
    const missing = required.filter(key => !data[key]);
    if (missing.length) {
      return sendJson(res, 400, { error: `Missing ${missing.join(", ")}` });
    }

    const reservation = {
      id: `RSV-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      name: String(data.name).trim(),
      phone: String(data.phone).trim(),
      date: String(data.date),
      time: String(data.time),
      guests: Number(data.guests),
      notes: String(data.notes || "").trim(),
      createdAt: new Date().toISOString(),
      status: "confirmed"
    };

    db.reservations.unshift(reservation);
    await writeDb(db);
    return sendJson(res, 201, { reservation });
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    const data = await readBody(req);
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return sendJson(res, 400, { error: "Add at least one item to order." });
    }
    if (!data.customer?.name || !data.customer?.phone || !data.customer?.address) {
      return sendJson(res, 400, { error: "Customer name, phone, and address are required." });
    }
    if (!validatePayment(data.paymentMethod)) {
      return sendJson(res, 400, { error: "Choose a valid payment option." });
    }
    const paymentReference = cleanReference(data.paymentReference);
    if (data.paymentMethod !== "cash" && paymentReference.length < 6) {
      return sendJson(res, 400, { error: "Enter a valid transaction reference for payment verification." });
    }

    const pricedItems = data.items.map(item => {
      const menuItem = db.menu.find(entry => entry.id === item.id);
      if (!menuItem) return null;
      const quantity = Math.max(1, Number(item.quantity || 1));
      return {
        id: menuItem.id,
        name: menuItem.name,
        quantity,
        price: menuItem.price,
        lineTotal: menuItem.price * quantity
      };
    }).filter(Boolean);

    if (!pricedItems.length) {
      return sendJson(res, 400, { error: "No valid menu items were found." });
    }

    const subtotal = pricedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee = data.fulfillment === "pickup" ? 0 : 120;
    const total = money(subtotal + deliveryFee);
    const payment = db.paymentOptions.find(option => option.id === data.paymentMethod);

    const order = {
      id: `OSBS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      customer: {
        name: String(data.customer.name).trim(),
        phone: String(data.customer.phone).trim(),
        address: String(data.customer.address).trim()
      },
      items: pricedItems,
      fulfillment: data.fulfillment === "pickup" ? "pickup" : "delivery",
      paymentMethod: data.paymentMethod,
      paymentLabel: payment.label,
      paymentReference: data.paymentMethod === "cash" ? "" : paymentReference,
      paymentInstructions: payment.instructions,
      subtotal,
      deliveryFee,
      total,
      status: data.paymentMethod === "cash" ? "pay-on-delivery" : "awaiting-payment-verification",
      createdAt: new Date().toISOString()
    };

    db.orders.unshift(order);
    await writeDb(db);
    return sendJson(res, 201, { order });
  }

  sendJson(res, 404, { error: "Not found" });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  } catch (error) {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": MIME[".html"] });
    res.end(fallback);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
    } else {
      await serveStatic(req, res);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`One Stop Burger Shop is running at http://localhost:${PORT}`);
});
