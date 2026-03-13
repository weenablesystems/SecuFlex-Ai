import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import bcrypt from "bcryptjs";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("security_ops.db");

// --- Validation Schemas ---
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const IncidentSchema = z.object({
  tenant_id: z.number(),
  client_id: z.number(),
  type: z.string(),
  location: z.string().optional(),
  severity: z.string(),
  description: z.string(),
});

const DispatchSchema = z.object({
  incident_id: z.number(),
  guard_id: z.number(),
  priority: z.number().min(1).max(5),
  tenant_id: z.number(),
});

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

  CREATE TABLE IF NOT EXISTS patrols (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    guard_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    location_lat REAL,
    location_lng REAL,
    notes TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (guard_id) REFERENCES guards(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );
`);

// Seed initial data if empty
const tenantCount = db.prepare("SELECT COUNT(*) as count FROM tenants").get() as { count: number };
if (tenantCount.count === 0) {
  const tenantId = db.prepare("INSERT INTO tenants (name, description) VALUES (?, ?)").run("🌐SecuFlex™ Demo", "Default demo tenant").lastInsertRowid;
  
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

  // --- Security Middleware ---
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for Vite dev compatibility
  }));
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });
  app.use("/api/", limiter);

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
    try {
      const { email, password } = LoginSchema.parse(req.body);
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
      
      if (user && bcrypt.compareSync(password, user.password)) {
        const { password, ...userWithoutPassword } = user;
        
        // Log successful login
        db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
          .run(user.tenant_id, "USER_LOGIN", `User ${user.email} logged in successfully`);
          
        res.json({ success: true, user: userWithoutPassword });
      } else {
        // Log failed login attempt
        db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
          .run(1, "LOGIN_FAILED", `Failed login attempt for email: ${email}`);
          
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (error) {
      res.status(400).json({ success: false, message: "Invalid input data" });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "operational", 
      version: "1.0.4-PRO",
      timestamp: new Date().toISOString(),
      database: "connected",
      environment: process.env.NODE_ENV || "development"
    });
  });

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
    try {
      const data = IncidentSchema.parse(req.body);
      const { tenant_id, client_id, type, location, severity, description } = data;
      
      const result = db.prepare(`
        INSERT INTO incidents (tenant_id, client_id, type, location, severity, description) 
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tenant_id, client_id, type, location, severity, description);
      
      db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
        .run(tenant_id, "INCIDENT_CREATED", `New incident ID: ${result.lastInsertRowid}`);
        
      broadcast({ type: "INCIDENT_CREATED", id: result.lastInsertRowid });
      res.json({ id: result.lastInsertRowid });
    } catch (error) {
      res.status(400).json({ error: "Invalid incident data" });
    }
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
    try {
      const { incident_id, guard_id, priority, tenant_id } = DispatchSchema.parse(req.body);
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
    } catch (error) {
      res.status(400).json({ error: "Invalid dispatch data" });
    }
  });

  app.get("/api/patrols", (req, res) => {
    const { tenant_id, guard_id } = req.query;
    let query = "SELECT * FROM patrols WHERE tenant_id = ?";
    const params: any[] = [tenant_id || 1];
    
    if (guard_id) {
      query += " AND guard_id = ?";
      params.push(guard_id);
    }
    
    const patrols = db.prepare(query).all(...params);
    res.json(patrols);
  });

  app.post("/api/patrols", (req, res) => {
    const { tenant_id, guard_id, client_id, location_lat, location_lng, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO patrols (tenant_id, guard_id, client_id, location_lat, location_lng, notes) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tenant_id, guard_id, client_id, location_lat, location_lng, notes);
    
    db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
      .run(tenant_id, "PATROL_LOGGED", `Guard ${guard_id} logged patrol at site ${client_id}`);
      
    broadcast({ type: "PATROL_LOGGED", id: result.lastInsertRowid, guard_id });
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/guards/status", (req, res) => {
    const { guard_id, status, tenant_id } = req.body;
    db.prepare("UPDATE guards SET status = ? WHERE id = ?").run(status, guard_id);
    
    db.prepare("INSERT INTO audit_logs (tenant_id, action, details) VALUES (?, ?, ?)")
      .run(tenant_id, "GUARD_STATUS_UPDATED", `Guard ${guard_id} status changed to ${status}`);
      
    broadcast({ type: "GUARD_STATUS_UPDATED", guard_id, status });
    res.json({ success: true });
  });

  app.post("/api/sync", (req, res) => {
    const { actions } = req.body;
    const results: any[] = [];
    
    const transaction = db.transaction((syncActions: any[]) => {
      for (const action of syncActions) {
        try {
          if (action.type === 'INCIDENT') {
            const { tenant_id, client_id, type, location, severity, description } = action.data;
            const result = db.prepare(`
              INSERT INTO incidents (tenant_id, client_id, type, location, severity, description) 
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(tenant_id, client_id, type, location, severity, description);
            results.push({ id: action.id, status: 'success', serverId: result.lastInsertRowid });
          } else if (action.type === 'PATROL') {
            const { tenant_id, guard_id, client_id, location_lat, location_lng, notes } = action.data;
            const result = db.prepare(`
              INSERT INTO patrols (tenant_id, guard_id, client_id, location_lat, location_lng, notes) 
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(tenant_id, guard_id, client_id, location_lat, location_lng, notes);
            results.push({ id: action.id, status: 'success', serverId: result.lastInsertRowid });
          } else if (action.type === 'STATUS_UPDATE') {
            const { guard_id, status, tenant_id } = action.data;
            db.prepare("UPDATE guards SET status = ? WHERE id = ?").run(status, guard_id);
            results.push({ id: action.id, status: 'success' });
          }
        } catch (error: any) {
          results.push({ id: action.id, status: 'error', message: error.message });
        }
      }
    });

    transaction(actions);
    
    // Broadcast a general sync event
    broadcast({ type: "SYNC_COMPLETED", count: actions.length });
    
    res.json({ results });
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
    console.log(`🌐SecuFlex™ POWERED BY: SA-iLabs™ Server running on http://localhost:${PORT}`);
  });
}

startServer();

