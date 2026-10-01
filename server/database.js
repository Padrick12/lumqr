const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'lumqr.db');

// Ensure directory exists if custom path is provided
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

async function initializeDatabase() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign keys and High-Performance WAL mode for NVMe SSD
  await db.run('PRAGMA foreign_keys = ON;');
  try {
    await db.run('PRAGMA journal_mode = WAL;');
    await db.run('PRAGMA synchronous = NORMAL;');
  } catch (err) {
    console.warn('WAL mode pragma warning:', err);
  }

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
      active_operator TEXT,
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
      operator_name TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status_at_install TEXT NOT NULL,
      notes TEXT,
      photo_before TEXT,
      photo_after TEXT,
      FOREIGN KEY (fixture_code) REFERENCES fixtures(code) ON DELETE CASCADE,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS poles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pole_code TEXT NOT NULL UNIQUE,
      crew_id INTEGER,
      operator_name TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      pole_type TEXT DEFAULT 'Concreto',
      lamp_type TEXT CHECK(lamp_type IN ('Vapor de Sodio', 'LED Antiguo', 'LED Nueva (Sin QR)', 'Sin Lámpara')) NOT NULL,
      zone_type TEXT CHECK(zone_type IN ('Urbana', 'Rural', 'Trayectos Seguros')) DEFAULT 'Urbana',
      wattage INTEGER,
      operating_status TEXT DEFAULT 'Funcionando',
      notes TEXT,
      photo_before TEXT,
      photo_after TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_id INTEGER NOT NULL,
      operator_name TEXT,
      incident_type TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      notes TEXT NOT NULL,
      photo_before TEXT,
      photo_after TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE
    );
  `);

  // Migrations for existing databases
  try {
    await db.run('ALTER TABLE installations ADD COLUMN operator_name TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE installations ADD COLUMN photo_before TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE installations ADD COLUMN photo_after TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE installations ADD COLUMN wattage INTEGER');
  } catch (e) {}

  try {
    await db.run('ALTER TABLE poles ADD COLUMN operator_name TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE poles ADD COLUMN photo_before TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE poles ADD COLUMN photo_after TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE poles ADD COLUMN wattage INTEGER');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE poles ADD COLUMN operating_status TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE poles ADD COLUMN offline_code TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE crews ADD COLUMN active_operator TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE batches ADD COLUMN default_wattage INTEGER');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE fixtures ADD COLUMN default_wattage INTEGER');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE installations ADD COLUMN offline_code TEXT');
  } catch (e) {}
  try {
    await db.run("ALTER TABLE installations ADD COLUMN zone_type TEXT DEFAULT 'Urbana'");
  } catch (e) {}
  try {
    await db.run('ALTER TABLE installations ADD COLUMN crew_name TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE poles ADD COLUMN crew_name TEXT');
  } catch (e) {}
  try {
    await db.run('ALTER TABLE incidents ADD COLUMN crew_name TEXT');
  } catch (e) {}

  // Data Corrections: Lot 1 150W Wattage, Graceros Rural Zone, and Test Fixture 301 Removal
  try {
    await db.run('UPDATE batches SET default_wattage = 150 WHERE id = 1');
    await db.run('UPDATE fixtures SET default_wattage = 150 WHERE batch_id = 1');
    await db.run(`
      UPDATE installations 
      SET wattage = 150 
      WHERE fixture_code IN (SELECT code FROM fixtures WHERE batch_id = 1) OR fixture_code LIKE 'LUM-LERDO-00%' OR fixture_code LIKE 'LUM-LERDO-01%' OR fixture_code LIKE 'LUM-LERDO-02%'
    `);
  } catch (e) {
    console.warn("Error updating batch 1 wattage:", e);
  }

  try {
    await db.run(`
      UPDATE installations 
      SET zone_type = 'Rural' 
      WHERE zone_type IS NULL OR zone_type = 'Urbana' OR LOWER(notes) LIKE '%graceros%' OR LOWER(notes) LIKE '%graseros%' OR fixture_code = 'LUM-LERDO-0014'
    `);
    await db.run(`
      UPDATE poles 
      SET zone_type = 'Rural' 
      WHERE zone_type IS NULL OR zone_type = 'Urbana'
    `);
  } catch (e) {
    console.warn("Error updating Graceros rural zone:", e);
  }

  try {
    await db.run('DELETE FROM installations WHERE fixture_code = "LUM-LERDO-0301" OR fixture_code = "LUM-LERDO-301"');
    await db.run('UPDATE fixtures SET status = "Nueva" WHERE code = "LUM-LERDO-0301" OR code = "LUM-LERDO-301"');
  } catch (e) {
    console.warn("Error resetting test fixture 301:", e);
  }

  // Deduplicate poles in DB that have exact same lat, lng, and created_at
  try {
    await db.run(`
      DELETE FROM poles 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM poles 
        GROUP BY lat, lng, created_at
      )
    `);
  } catch (e) {
    console.warn("Error deduplicating poles table:", e);
  }

  // Seed default admin if no admin exists
  const adminCount = await db.get('SELECT COUNT(*) as count FROM admins');
  if (adminCount.count === 0) {
    console.log('Seeding initial default admin account...');
    await db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', 'admin123']);
  }

  return db;
}

module.exports = {
  initializeDatabase,
  dbPath
};
