const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'lumqr.db');

async function initializeDatabase() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys
  await db.run('PRAGMA foreign_keys = ON;');

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      members TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code_prefix TEXT NOT NULL,
      total_quantity INTEGER NOT NULL,
      arrival_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      code TEXT PRIMARY KEY,
      batch_id INTEGER NOT NULL,
      crew_id INTEGER,
      status TEXT CHECK(status IN ('Nueva', 'Reparada', 'Rehabilitada', 'Robo')) DEFAULT 'Nueva',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_code TEXT NOT NULL,
      crew_id INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status_at_install TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (fixture_code) REFERENCES fixtures(code) ON DELETE CASCADE,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS poles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pole_code TEXT NOT NULL UNIQUE,
      crew_id INTEGER,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      pole_type TEXT DEFAULT 'Concreto',
      lamp_type TEXT CHECK(lamp_type IN ('Vapor de Sodio', 'LED Antiguo', 'LED Nueva (Sin QR)', 'Sin Lámpara')) NOT NULL,
      zone_type TEXT CHECK(zone_type IN ('Urbana', 'Rural', 'Trayectos Seguros')) DEFAULT 'Urbana',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE SET NULL
    );
  `);

  // Seed default data if database is empty
  const crewCount = await db.get('SELECT COUNT(*) as count FROM crews');
  if (crewCount.count === 0) {
    console.log('Seeding initial database content...');

    // 0. Seed admin
    const adminCount = await db.get('SELECT COUNT(*) as count FROM admins');
    if (adminCount.count === 0) {
      await db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', 'admin123']);
    }

    // (Seed crews, batches, etc. removed for production)
  }

  return db;
}

module.exports = {
  initializeDatabase,
  dbPath
};
