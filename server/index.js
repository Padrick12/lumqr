const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { initializeDatabase } = require('./database');
const { saveBase64Image } = require('./utils/fileStorage');
const { createDatabaseBackup, listBackups, BACKUPS_DIR } = require('./scripts/backup');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'lumqr_secret_key_lerdo_2026';

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Serve physical uploaded evidence photos statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend assets if built
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

let db;

// Nightly Backup Scheduler (00:00 AM)
function setupNightlyBackup() {
  const checkInterval = 60 * 60 * 1000; // Check every hour
  let lastBackupDay = -1;

  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDate();

    if (hour === 0 && day !== lastBackupDay) {
      lastBackupDay = day;
      try {
        const backupResult = await createDatabaseBackup();
        console.log('📦 Nightly database backup created successfully:', backupResult.filename);
      } catch (err) {
        console.error('❌ Nightly database backup failed:', err);
      }
    }
  }, checkInterval);
}

// Initialize Database connection and start server
initializeDatabase()
  .then(database => {
    db = database;
    setupNightlyBackup();
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// --- API ROUTES ---

// 1. Auth Login (JWT Token with 12-Hour Expiration)
app.post('/api/auth/login', async (req, res) => {
  const { username, password, type } = req.body;
  if (!username || !password || !type) {
    return res.status(400).json({ error: 'Faltan credenciales.' });
  }

  try {
    if (type === 'admin') {
      const admin = await db.get('SELECT * FROM admins WHERE username = ? AND password = ?', [username, password]);
      if (admin) {
        const token = jwt.sign(
          { role: 'admin', admin_id: admin.id, username: admin.username },
          JWT_SECRET,
          { expiresIn: '12h' }
        );
        return res.json({ role: 'admin', admin_id: admin.id, admin_name: admin.username, token });
      }
    } else if (type === 'operator') {
      const crew = await db.get('SELECT * FROM crews WHERE username = ? AND password = ?', [username, password]);
      if (crew) {
        const token = jwt.sign(
          { role: 'operator', crew_id: crew.id, crew_name: crew.name },
          JWT_SECRET,
          { expiresIn: '12h' }
        );
        return res.json({ role: 'operator', crew_id: crew.id, crew_name: crew.name, token });
      }
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backups Management Routes
app.get('/api/admin/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (err) {
    res.status(500).json({ error: 'Error listing backups.' });
  }
});

app.post('/api/admin/backups/trigger', async (req, res) => {
  try {
    const backup = await createDatabaseBackup();
    res.json({ message: 'Respaldo manual generado con éxito.', backup });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar respaldo manual.' });
  }
});

app.get('/api/admin/backups/download/:filename', (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(BACKUPS_DIR, safeFilename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, safeFilename);
  } else {
    res.status(404).json({ error: 'Archivo de respaldo no encontrado.' });
  }
});

// 1.5 Admin Profile
app.get('/api/admins', async (req, res) => {
  try {
    const admins = await db.all('SELECT id, username, password, created_at FROM admins ORDER BY id ASC');
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admins', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  try {
    const result = await db.run('INSERT INTO admins (username, password) VALUES (?, ?)', [username, password]);
    res.status(201).json({ id: result.lastID, username, password });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM admins WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admins/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }
  try {
    const result = await db.run(
      'UPDATE admins SET username = ?, password = ? WHERE id = ?',
      [username, password, id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Administrador no encontrado.' });
    }
    res.json({ message: 'Perfil actualizado con éxito.' });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// 2. Crews CRUD
app.get('/api/crews', async (req, res) => {
  try {
    const crews = await db.all('SELECT * FROM crews ORDER BY name ASC');
    // Parse members JSON
    const formattedCrews = crews.map(c => ({
      ...c,
      members: JSON.parse(c.members)
    }));
    res.json(formattedCrews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/crews', async (req, res) => {
  const { name, username, password, members, active_operator } = req.body;
  if (!name || !username || !password || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios o formato incorrecto.' });
  }
  try {
    const result = await db.run(
      'INSERT INTO crews (name, username, password, members, active_operator) VALUES (?, ?, ?, ?, ?)',
      [name, username, password, JSON.stringify(members), active_operator || null]
    );
    res.status(201).json({ id: result.lastID, name, username, members, active_operator: active_operator || null });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Ya existe una cuadrilla con este nombre o usuario.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/crews/:id', async (req, res) => {
  const { id } = req.params;
  const { name, username, password, members, active_operator } = req.body;
  if (!name || !username || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Campos requeridos vacíos o incorrectos.' });
  }
  try {
    const existing = await db.get('SELECT * FROM crews WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Cuadrilla no encontrada.' });
    }

    const finalPassword = (password && password.trim()) ? password : existing.password;
    const finalOperator = active_operator !== undefined ? active_operator : existing.active_operator;

    await db.run(
      'UPDATE crews SET name = ?, username = ?, password = ?, members = ?, active_operator = ? WHERE id = ?',
      [name, username, finalPassword, JSON.stringify(members), finalOperator, id]
    );
    res.json({ id: Number(id), name, username, members, active_operator: finalOperator });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/crews/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.run('DELETE FROM crews WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cuadrilla no encontrada.' });
    }
    res.json({ message: 'Cuadrilla eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Batches Reception (Recepción)
app.get('/api/batches', async (req, res) => {
  try {
    const batches = await db.all('SELECT * FROM batches ORDER BY id DESC');
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/batches', async (req, res) => {
  const { code_prefix, total_quantity, arrival_date } = req.body;
  if (!code_prefix || !total_quantity || !arrival_date) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos para el lote.' });
  }

  try {
    // Start transaction
    await db.run('BEGIN TRANSACTION;');

    const batchResult = await db.run(
      'INSERT INTO batches (code_prefix, total_quantity, arrival_date) VALUES (?, ?, ?)',
      [code_prefix.toUpperCase(), total_quantity, arrival_date]
    );
    const batchId = batchResult.lastID;

    // 1. Find the highest existing sequence number for this prefix
    const maxCodeRow = await db.get(
      `SELECT code FROM fixtures WHERE code LIKE ? ORDER BY code DESC LIMIT 1`,
      [`${code_prefix.toUpperCase()}-%`]
    );

    let startNum = 1;
    if (maxCodeRow) {
      const parts = maxCodeRow.code.split('-');
      const lastNumStr = parts[parts.length - 1];
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) {
        startNum = lastNum + 1;
      }
    }

    // Generate individual fixtures
    for (let i = 0; i < total_quantity; i++) {
      const currentNum = startNum + i;
      const code = `${code_prefix.toUpperCase()}-${String(currentNum).padStart(4, '0')}`;
      await db.run(
        'INSERT INTO fixtures (code, batch_id, crew_id, status) VALUES (?, ?, NULL, "Nueva")',
        [code, batchId]
      );
    }

    await db.run('COMMIT;');
    res.status(201).json({
      id: batchId,
      code_prefix: code_prefix.toUpperCase(),
      total_quantity,
      arrival_date
    });
  } catch (error) {
    await db.run('ROLLBACK;');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/batches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('BEGIN TRANSACTION;');
    await db.run('DELETE FROM installations WHERE fixture_code IN (SELECT code FROM fixtures WHERE batch_id = ?)', [id]);
    await db.run('DELETE FROM fixtures WHERE batch_id = ?', [id]);
    const result = await db.run('DELETE FROM batches WHERE id = ?', [id]);
    await db.run('COMMIT;');

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lote no encontrado.' });
    }
    res.json({ message: 'Lote y sus registros asociados eliminados correctamente.' });
  } catch (error) {
    await db.run('ROLLBACK;');
    res.status(500).json({ error: error.message });
  }
});

// 3. Batch Distribution to Crews (Asignación Estratégica)
// Assign a quantity of unassigned fixtures in a batch to a crew
app.post('/api/batches/assign', async (req, res) => {
  const { crew_id, batch_id, quantity } = req.body;
  if (!crew_id || !batch_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Faltan parámetros de asignación válidos.' });
  }

  try {
    await db.run('BEGIN TRANSACTION;');

    // 1. Get first 'quantity' of unassigned fixtures from this batch
    const unassigned = await db.all(
      'SELECT code FROM fixtures WHERE batch_id = ? AND crew_id IS NULL ORDER BY code ASC LIMIT ?',
      [batch_id, quantity]
    );

    if (unassigned.length < quantity) {
      await db.run('ROLLBACK;');
      return res.status(400).json({
        error: `Inventario insuficiente. Solo quedan ${unassigned.length} luminarias libres en este lote.`
      });
    }

    const codes = unassigned.map(f => f.code);
    const startCode = codes[0];
    const endCode = codes[codes.length - 1];

    // 2. Update crew_id for these fixtures
    const placeHolders = codes.map(() => '?').join(',');
    await db.run(
      `UPDATE fixtures SET crew_id = ? WHERE code IN (${placeHolders})`,
      [crew_id, ...codes]
    );

    await db.run('COMMIT;');
    res.json({
      message: 'Luminarias asignadas con éxito.',
      crew_id,
      batch_id,
      assigned_count: codes.length,
      range: { startCode, endCode }
    });
  } catch (error) {
    await db.run('ROLLBACK;');
    res.status(500).json({ error: error.message });
  }
});

// 4. Register Installation / Change Status (Despliegue & Mantenimiento)
app.post('/api/installations', async (req, res) => {
  const { code, crew_id, operator_name, lat, lng, notes, status, installed_at, photo_before, photo_after, wattage } = req.body;

  if (!code || !lat || !lng || !status) {
    return res.status(400).json({ error: 'Faltan parámetros (code, lat, lng, status).' });
  }

  try {
    await db.run('BEGIN TRANSACTION;');

    // Save base64 photos to NVMe disk
    const photoBeforePath = saveBase64Image(photo_before, 'evidences');
    const photoAfterPath = saveBase64Image(photo_after, 'evidences');

    // Verify fixture exists
    const fixture = await db.get('SELECT * FROM fixtures WHERE code = ?', [code]);
    if (!fixture) {
      await db.run('ROLLBACK;');
      return res.status(404).json({ error: `La luminaria con código ${code} no está registrada en el inventario.` });
    }

    // Determine final crew_id
    const finalCrewId = crew_id || fixture.crew_id;
    if (!finalCrewId) {
      await db.run('ROLLBACK;');
      return res.status(400).json({
        error: `La luminaria ${code} no tiene una cuadrilla asignada. Asigne la luminaria a una cuadrilla primero.`
      });
    }

    // Insert installation log
    const dateStr = installed_at || new Date().toISOString();
    const parsedWattage = wattage ? Number(wattage) : null;

    await db.run(
      `INSERT INTO installations (fixture_code, crew_id, operator_name, lat, lng, installed_at, status_at_install, notes, photo_before, photo_after, wattage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, finalCrewId, operator_name || null, lat, lng, dateStr, status, notes || '', photoBeforePath || null, photoAfterPath || null, parsedWattage]
    );

    // Update fixture state and ensure it links to the installing crew if it wasn't
    await db.run(
      'UPDATE fixtures SET status = ?, crew_id = ? WHERE code = ?',
      [status, finalCrewId, code]
    );

    await db.run('COMMIT;');
    res.status(201).json({
      message: 'Instalación/Registro actualizado con éxito.',
      code,
      crew_id: finalCrewId,
      operator_name: operator_name || null,
      status,
      lat,
      lng,
      wattage: parsedWattage,
      installed_at: dateStr,
      photo_before: photoBeforePath || null,
      photo_after: photoAfterPath || null
    });
  } catch (error) {
    await db.run('ROLLBACK;');
    res.status(500).json({ error: error.message });
  }
});

// Bulk sync for offline-first queue
app.post('/api/installations/sync', async (req, res) => {
  const { queue } = req.body;
  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({ error: 'Cola de sincronización inválida.' });
  }

  const results = { succeeded: [], failed: [] };

  for (const item of queue) {
    try {
      await db.run('BEGIN TRANSACTION;');

      const fixture = await db.get('SELECT * FROM fixtures WHERE code = ?', [item.code]);
      if (!fixture) {
        throw new Error(`Código ${item.code} no existe en inventario.`);
      }

      const finalCrewId = item.crew_id || fixture.crew_id;
      if (!finalCrewId) {
        throw new Error(`Código ${item.code} no tiene cuadrilla asignada.`);
      }

      const dateStr = item.installed_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db.run(
        `INSERT INTO installations (fixture_code, crew_id, operator_name, lat, lng, installed_at, status_at_install, notes, photo_before, photo_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.code, finalCrewId, item.operator_name || null, item.lat, item.lng, dateStr, item.status, item.notes || 'Sincronizado Offline', item.photo_before || null, item.photo_after || null]
      );

      await db.run(
        'UPDATE fixtures SET status = ?, crew_id = ? WHERE code = ?',
        [item.status, finalCrewId, item.code]
      );

      await db.run('COMMIT;');
      results.succeeded.push(item.code);
    } catch (err) {
      await db.run('ROLLBACK;');
      results.failed.push({ code: item.code, error: err.message });
    }
  }

  res.json({
    message: 'Sincronización finalizada.',
    succeeded_count: results.succeeded.length,
    failed_count: results.failed.length,
    results
  });
});

// Get installations for map dashboard
app.get('/api/installations', async (req, res) => {
  try {
    // Get latest installation coordinates for each fixture that has been installed
    const query = `
      SELECT i.*, f.status as current_status, c.name as crew_name, b.arrival_date, b.code_prefix
      FROM installations i
      JOIN (
        SELECT fixture_code, MAX(installed_at) as max_date
        FROM installations
        GROUP BY fixture_code
      ) latest ON i.fixture_code = latest.fixture_code AND i.installed_at = latest.max_date
      JOIN fixtures f ON i.fixture_code = f.code
      JOIN crews c ON i.crew_id = c.id
      JOIN batches b ON f.batch_id = b.id
      ORDER BY i.installed_at DESC
    `;
    const installations = await db.all(query);
    res.json(installations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Get History for a Fixture
app.get('/api/fixtures/:code/history', async (req, res) => {
  const { code } = req.params;
  try {
    const fixture = await db.get(`
      SELECT f.*, c.name as crew_name, b.arrival_date 
      FROM fixtures f
      LEFT JOIN crews c ON f.crew_id = c.id
      JOIN batches b ON f.batch_id = b.id
      WHERE f.code = ?
    `, [code]);

    if (!fixture) {
      return res.status(404).json({ error: 'Luminaria no encontrada.' });
    }

    const history = await db.all(`
      SELECT i.*, c.name as crew_name
      FROM installations i
      JOIN crews c ON i.crew_id = c.id
      WHERE i.fixture_code = ?
      ORDER BY i.installed_at DESC
    `, [code]);

    res.json({ fixture, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset/Delete installation history for a specific QR fixture code (for test cleanup)
app.delete('/api/fixtures/:code/reset', async (req, res) => {
  const { code } = req.params;
  try {
    await db.run('DELETE FROM installations WHERE fixture_code = ?', [code]);
    await db.run('UPDATE fixtures SET status = "Nueva" WHERE code = ?', [code]);
    res.json({ message: `Luminaria ${code} reseteada exitosamente. Instalaciones de prueba eliminadas.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a fixture completely
app.delete('/api/fixtures/:code', async (req, res) => {
  const { code } = req.params;
  try {
    await db.run('DELETE FROM installations WHERE fixture_code = ?', [code]);
    await db.run('DELETE FROM fixtures WHERE code = ?', [code]);
    res.json({ message: `Luminaria ${code} eliminada del sistema.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Global Reports & Inventory Stats
app.get('/api/reports', async (req, res) => {
  try {
    // Inventory summary counts
    const totalCount = await db.get('SELECT COUNT(*) as count FROM fixtures');
    const statusCounts = await db.all('SELECT status, COUNT(*) as count FROM fixtures GROUP BY status');
    
    // Assigned vs Unassigned
    const assignedCount = await db.get('SELECT COUNT(*) as count FROM fixtures WHERE crew_id IS NOT NULL');
    const unassignedCount = await db.get('SELECT COUNT(*) as count FROM fixtures WHERE crew_id IS NULL');

    // Installations count
    const installedCount = await db.get('SELECT COUNT(DISTINCT fixture_code) as count FROM installations');

    // List of all fixtures with crew name and current status
    const allFixtures = await db.all(`
      SELECT f.code, f.status, f.batch_id, c.name as crew_name, b.code_prefix, b.arrival_date
      FROM fixtures f
      LEFT JOIN crews c ON f.crew_id = c.id
      JOIN batches b ON f.batch_id = b.id
      ORDER BY f.code ASC
    `);

    const polesCount = await db.get('SELECT COUNT(*) as count FROM poles');
    const polesByLamp = await db.all('SELECT lamp_type, COUNT(*) as count FROM poles GROUP BY lamp_type');
    const polesByZone = await db.all('SELECT zone_type, COUNT(*) as count FROM poles GROUP BY zone_type');

    // Crew Performance Metrics
    const crewPerformance = await db.all(`
      SELECT 
        c.id, 
        c.name as crew_name, 
        c.active_operator,
        (SELECT COUNT(*) FROM installations i WHERE i.crew_id = c.id) as total_installations,
        (SELECT COUNT(*) FROM poles p WHERE p.crew_id = c.id) as total_poles
      FROM crews c
      ORDER BY (total_installations + total_poles) DESC
    `);

    res.json({
      summary: {
        total: totalCount.count,
        assigned: assignedCount.count,
        unassigned: unassignedCount.count,
        installed: installedCount.count,
        statuses: statusCounts.reduce((acc, curr) => {
          acc[curr.status] = curr.count;
          return acc;
        }, { Nueva: 0, Reparada: 0, Rehabilitada: 0, Robo: 0 }),
        total_poles: polesCount ? polesCount.count : 0,
        poles_by_lamp: polesByLamp.reduce((acc, curr) => {
          acc[curr.lamp_type] = curr.count;
          return acc;
        }, { 'Vapor de Sodio': 0, 'LED Antiguo': 0, 'LED Nueva (Sin QR)': 0, 'Sin Lámpara': 0 }),
        poles_by_zone: polesByZone.reduce((acc, curr) => {
          acc[curr.zone_type] = curr.count;
          return acc;
        }, { Urbana: 0, Rural: 0, 'Trayectos Seguros': 0 })
      },
      crew_performance: crewPerformance,
      fixtures: allFixtures
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Poles Census Endpoints
app.get('/api/poles', async (req, res) => {
  try {
    const poles = await db.all(`
      SELECT p.*, c.name as crew_name
      FROM poles p
      LEFT JOIN crews c ON p.crew_id = c.id
      ORDER BY p.id DESC
    `);
    res.json(poles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/poles', async (req, res) => {
  const { crew_id, operator_name, lat, lng, pole_type, lamp_type, zone_type, wattage, operating_status, notes, photo_before, photo_after } = req.body;

  if (!lat || !lng || !lamp_type) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (lat, lng, lamp_type).' });
  }

  try {
    const photoBeforePath = saveBase64Image(photo_before, 'evidences');
    const photoAfterPath = saveBase64Image(photo_after, 'evidences');

    const countRow = await db.get('SELECT COUNT(*) as count FROM poles');
    const poleCode = `PST-${String((countRow.count || 0) + 1).padStart(5, '0')}`;
    const isoDate = new Date().toISOString();

    const result = await db.run(`
      INSERT INTO poles (pole_code, crew_id, operator_name, lat, lng, pole_type, lamp_type, zone_type, wattage, operating_status, notes, photo_before, photo_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      poleCode,
      crew_id || null,
      operator_name || null,
      lat,
      lng,
      pole_type || 'Concreto',
      lamp_type,
      zone_type || 'Urbana',
      wattage ? Number(wattage) : null,
      operating_status || 'Funcionando',
      notes || '',
      photoBeforePath || null,
      photoAfterPath || null,
      isoDate
    ]);

    res.status(201).json({
      message: 'Poste censado correctamente.',
      id: result.lastID,
      pole_code: poleCode,
      operator_name: operator_name || null,
      lat,
      lng,
      lamp_type,
      zone_type: zone_type || 'Urbana',
      wattage: wattage ? Number(wattage) : null,
      operating_status: operating_status || 'Funcionando',
      photo_before: photo_before || null,
      photo_after: photo_after || null,
      created_at: isoDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/poles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.run('DELETE FROM poles WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Poste no encontrado.' });
    }
    res.json({ message: 'Poste eliminado del censo.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/poles/code/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await db.run('DELETE FROM poles WHERE pole_code = ?', [code]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Poste no encontrado.' });
    }
    res.json({ message: `Poste ${code} eliminado del censo.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Field Incidents / Special Maintenance Reports
app.get('/api/incidents', async (req, res) => {
  try {
    const incidents = await db.all(`
      SELECT i.*, c.name as crew_name
      FROM incidents i
      LEFT JOIN crews c ON i.crew_id = c.id
      ORDER BY i.id DESC
    `);
    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/incidents', async (req, res) => {
  const { crew_id, operator_name, incident_type, lat, lng, notes, photo_before, photo_after } = req.body;

  if (!crew_id || !incident_type || !notes || notes.trim().length < 5) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos o la justificación es menor a 5 caracteres.' });
  }

  try {
    const photoBeforePath = saveBase64Image(photo_before, 'evidences');
    const photoAfterPath = saveBase64Image(photo_after, 'evidences');
    const isoDate = new Date().toISOString();

    const result = await db.run(`
      INSERT INTO incidents (crew_id, operator_name, incident_type, lat, lng, notes, photo_before, photo_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      crew_id,
      operator_name || null,
      incident_type,
      lat || 25.539,
      lng || -103.524,
      notes.trim(),
      photoBeforePath || null,
      photoAfterPath || null,
      isoDate
    ]);

    res.status(201).json({
      message: 'Incidencia / Reporte especial guardado con éxito.',
      id: result.lastID,
      crew_id,
      operator_name: operator_name || null,
      incident_type,
      lat,
      lng,
      notes: notes.trim(),
      photo_before: photoBeforePath || null,
      photo_after: photoAfterPath || null,
      created_at: isoDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Manual Disaster Recovery Backup Trigger
app.post('/api/backup', async (req, res) => {
  try {
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupsDir, `lumqr_backup_${dateStr}.db`);

    await db.run('VACUUM INTO ?', [backupPath]);
    res.json({ message: 'Respaldo generado exitosamente.', filename: path.basename(backupPath) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SPA Fallback: Send index.html for all non-API GET requests
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

