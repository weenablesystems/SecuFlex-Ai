import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("security_ops.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Operator',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS guards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'Available',
    location_lat REAL,
    location_lng REAL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    location TEXT,
    severity TEXT,
    description TEXT,
    status TEXT DEFAULT 'Open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL,
    guard_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    status TEXT DEFAULT 'Assigned',
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (guard_id) REFERENCES guards(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );
`);

// Seed initial data if empty
const tenantCount = db.prepare("SELECT COUNT(*) as count FROM tenants").get() as { count: number };
if (tenantCount.count === 0) {
  const tenantId = db.prepare("INSERT INTO tenants (name, description) VALUES (?, ?)").run("🌐SA-iLabs™ Demo", "Default demo tenant").lastInsertRowid;
  
  // Create default user: ops-center@sa-ilabs.com / password123
  const hashedPassword = bcrypt.hashSync("password123", 10);
  db.prepare("INSERT INTO users (tenant_id, email, password, name, role) VALUES (?, ?, ?, ?, ?)")
    .run(tenantId, "ops-center@sa-ilabs.com", hashedPassword, "Ops Supervisor", "Admin");

  const siteId = db.prepare("INSERT INTO clients (tenant_id, name, address) VALUES (?, ?, ?)").run(tenantId, "Sunset Estate", "123 Ocean Drive, Cape Town").lastInsertRowid;
  
  db.prepare("INSERT INTO guards (tenant_id, name, phone, status) VALUES (?, ?, ?, ?)").run(tenantId, "John Doe", "+27 82 123 4567", "Available");
  db.prepare("INSERT INTO guards (tenant_id, name, phone, status) VALUES (?, ?, ?, ?)").run(tenantId, "Jane Smith", "+27 83 987 6543", "Available");
  
  db.prepare("INSERT INTO incidents (tenant_id, client_id, type, location, severity, description) VALUES (?, ?, ?, ?, ?, ?)")
    .run(tenantId, siteId, "Intrusion Alarm", "Zone 4 - Perimeter Fence", "High", "Motion detected on north fence line.");
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // WebSocket Broadcasting
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Auth Routes
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    
    if (user && bcrypt.compareSync(password, user.password)) {
      const { password, ...userWithoutPassword } = user;
      res.json({ success: true, user: userWithoutPassword });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // API Routes
  app.get("/api/tenants", (req, res) => {
    const tenants = db.prepare("SELECT * FROM tenants").all();
    res.json(tenants);
  });

  app.get("/api/incidents", (req, res) => {
    const { tenant_id } = req.query;
    const incidents = db.prepare(`
      SELECT i.*, c.name as client_name 
      FROM incidents i 
      JOIN clients c ON i.client_id = c.id 
      WHERE i.tenant_id = ? 
      ORDER BY i.created_at DESC
    `).all(tenant_id || 1);
    res.json(incidents);
  });

  app.post("/api/incidents", (req, res) => {
    const { tenant_id, client_id, type, location, severity, description } = req.body;
    const result = db.prepare(`
      INSERT INTO incidents (tenant_id, client_id, type, location, severity, description) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tenant_id, client_id, type, location, severity, description);
    
    db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
      .run(tenant_id, "INCIDENT_CREATED", `New incident ID: ${result.lastInsertRowid}`);
      
    broadcast({ type: "INCIDENT_CREATED", id: result.lastInsertRowid });
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/guards", (req, res) => {
    const { tenant_id } = req.query;
    const guards = db.prepare("SELECT * FROM guards WHERE tenant_id = ?").all(tenant_id || 1);
    res.json(guards);
  });

  app.get("/api/clients", (req, res) => {
    const { tenant_id } = req.query;
    const clients = db.prepare("SELECT * FROM clients WHERE tenant_id = ?").all(tenant_id || 1);
    res.json(clients);
  });

  app.post("/api/dispatch", (req, res) => {
    const { incident_id, guard_id, priority, tenant_id } = req.body;
    const result = db.prepare(`
      INSERT INTO dispatches (incident_id, guard_id, priority) 
      VALUES (?, ?, ?)
    `).run(incident_id, guard_id, priority);
    
    db.prepare("UPDATE incidents SET status = 'Dispatched' WHERE id = ?").run(incident_id);
    db.prepare("UPDATE guards SET status = 'Busy' WHERE id = ?").run(guard_id);
    
    db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
      .run(tenant_id, "GUARD_DISPATCHED", `Guard ${guard_id} assigned to incident ${incident_id}`);
      
    broadcast({ type: "GUARD_DISPATCHED", incident_id, guard_id });
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/stats", (req, res) => {
    const { tenant_id } = req.query;
    const tid = tenant_id || 1;
    const activeIncidents = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE tenant_id = ? AND status != 'Closed'").get(tid) as { count: number };
    const availableGuards = db.prepare("SELECT COUNT(*) as count FROM guards WHERE tenant_id = ? AND status = 'Available'").get(tid) as { count: number };
    const todayIncidents = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE tenant_id = ? AND date(created_at) = date('now')").get(tid) as { count: number };
    
    res.json({
      activeIncidents: activeIncidents.count,
      availableGuards: availableGuards.count,
      todayIncidents: todayIncidents.count
    });
  });

  app.get("/api/audit-logs", (req, res) => {
    const { tenant_id } = req.query;
    const logs = db.prepare("SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT 100").all(tenant_id || 1);
    res.json(logs);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐SA-iLabs™ Security Ops Server running on http://localhost:${PORT}`);
  });
}

startServer();
