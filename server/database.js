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
      zone_type TEXT CHECK(zone_type IN ('Urbana', 'Rural', 'Trayectos Seguros')) DEFAULT 'Rural',
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
      incident_code TEXT UNIQUE,
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
    await db.run("ALTER TABLE installations ADD COLUMN zone_type TEXT DEFAULT 'Rural'");
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
  try {
    await db.run('ALTER TABLE incidents ADD COLUMN incident_code TEXT');
  } catch (e) {}

  // Auto-generate incident_code folios for any existing incidents in DB
  try {
    const uncodedIncidents = await db.all('SELECT id FROM incidents WHERE incident_code IS NULL OR incident_code = "" ORDER BY id ASC');
    for (const inc of uncodedIncidents) {
      const code = `INC-${String(inc.id).padStart(5, '0')}`;
      await db.run('UPDATE incidents SET incident_code = ? WHERE id = ?', [code, inc.id]);
    }
  } catch (e) {
    console.warn("Error assigning incident_code folios:", e);
  }

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
    const { classifyZone } = require('./utils/zoneClassifier');
    
    const allInsts = await db.all('SELECT id, lat, lng, notes, zone_type FROM installations');
    for (const inst of allInsts) {
      const smartZone = classifyZone(inst.lat, inst.lng, inst.notes, null);
      if (inst.zone_type !== smartZone) {
        await db.run('UPDATE installations SET zone_type = ? WHERE id = ?', [smartZone, inst.id]);
      }
    }

    const allPoles = await db.all('SELECT id, lat, lng, notes, zone_type FROM poles');
    for (const pole of allPoles) {
      const smartZone = classifyZone(pole.lat, pole.lng, pole.notes, null);
      if (pole.zone_type !== smartZone) {
        await db.run('UPDATE poles SET zone_type = ? WHERE id = ?', [smartZone, pole.id]);
      }
    }
  } catch (e) {
    console.warn("Error running smart zone classification migration:", e);
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

  // Ensure LUM-LERDO-0010 is registered in installations table with evidence photos
  try {
    const { saveBase64Image } = require('./utils/fileStorage');
    const lum0010Photos = require('./lum0010_photos');
    
    const photoBPath = saveBase64Image(lum0010Photos.photo_before, 'evidences');
    const photoAPath = saveBase64Image(lum0010Photos.photo_after, 'evidences');

    const inst0010 = await db.get('SELECT * FROM installations WHERE fixture_code = ?', ['LUM-LERDO-0010']);
    if (!inst0010) {
      const crewRow = (await db.get('SELECT id FROM crews WHERE name LIKE "%SPA-02%"')) || { id: 1 };
      const crewId = crewRow.id;
      
      const fix0010 = await db.get('SELECT * FROM fixtures WHERE code = ?', ['LUM-LERDO-0010']);
      if (!fix0010) {
        await db.run('INSERT INTO fixtures (code, batch_id, crew_id, status, default_wattage) VALUES (?, 1, ?, "Nueva", 150)', ['LUM-LERDO-0010', crewId]);
      } else {
        await db.run('UPDATE fixtures SET crew_id = ?, status = "Nueva", default_wattage = 150 WHERE code = ?', [crewId, 'LUM-LERDO-0010']);
      }

      await db.run(`
        INSERT INTO installations (fixture_code, crew_id, operator_name, lat, lng, installed_at, status_at_install, notes, wattage, zone_type, offline_code, photo_before, photo_after)
        VALUES ('LUM-LERDO-0010', ?, 'Jose Nieves', 25.265801265694268, -103.7743342987044, '2026-09-30 16:09:00', 'Nueva', 'Lampara nueva', 150, 'Rural', 'LUM-LERDO-0010', ?, ?)
      `, [crewId, photoBPath, photoAPath]);

      await db.run('UPDATE fixtures SET status = "Nueva", crew_id = ? WHERE code = "LUM-LERDO-0010"', [crewId]);
      console.log('✅ LUM-LERDO-0010 missing fixture auto-synced with evidence photos into database.');
    } else {
      await db.run(`
        UPDATE installations 
        SET photo_before = ?, photo_after = ?
        WHERE fixture_code = 'LUM-LERDO-0010'
      `, [photoBPath, photoAPath]);
    }
  } catch (e) {
    console.warn("Error auto-syncing LUM-LERDO-0010 photos:", e);
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
