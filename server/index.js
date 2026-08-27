const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Serve static frontend assets if built
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

let db;

// Initialize Database connection and start server
initializeDatabase()
  .then(database => {
    db = database;
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// --- API ROUTES ---

// 1. Auth Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password, type } = req.body;
  if (!username || !password || !type) {
    return res.status(400).json({ error: 'Faltan credenciales.' });
  }

  try {
    if (type === 'admin') {
      const admin = await db.get('SELECT * FROM admins WHERE username = ? AND password = ?', [username, password]);
      if (admin) {
        return res.json({ role: 'admin', admin_id: admin.id, admin_name: admin.username });
      }
    } else if (type === 'operator') {
      const crew = await db.get('SELECT * FROM crews WHERE username = ? AND password = ?', [username, password]);
      if (crew) {
        return res.json({ role: 'operator', crew_id: crew.id, crew_name: crew.name });
      }
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  const { name, username, password, members } = req.body;
  if (!name || !username || !password || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios o formato incorrecto.' });
  }
  try {
    const result = await db.run(
      'INSERT INTO crews (name, username, password, members) VALUES (?, ?, ?, ?)',
      [name, username, password, JSON.stringify(members)]
    );
    res.status(201).json({ id: result.lastID, name, username, members });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Ya existe una cuadrilla con este nombre o usuario.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/crews/:id', async (req, res) => {
  const { id } = req.params;
  const { name, username, password, members } = req.body;
  if (!name || !username || !password || !members || !Array.isArray(members)) {
    return res.status(400).json({ error: 'Campos requeridos vacíos o incorrectos.' });
  }
  try {
    const result = await db.run(
      'UPDATE crews SET name = ?, username = ?, password = ?, members = ? WHERE id = ?',
      [name, username, password, JSON.stringify(members), id]
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Cuadrilla no encontrada.' });
    }
    res.json({ id: Number(id), name, username, members });
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
    const result = await db.run('DELETE FROM batches WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lote no encontrado.' });
    }
    // Foreign keys with ON DELETE CASCADE will automatically delete fixtures and their installations
    res.json({ message: 'Lote eliminado correctamente.' });
  } catch (error) {
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
  const { code, crew_id, operator_name, lat, lng, notes, status, installed_at, photo_before, photo_after } = req.body;

  if (!code || !lat || !lng || !status) {
    return res.status(400).json({ error: 'Faltan parámetros (code, lat, lng, status).' });
  }

  try {
    await db.run('BEGIN TRANSACTION;');

    // Verify fixture exists
    const fixture = await db.get('SELECT * FROM fixtures WHERE code = ?', [code]);
    if (!fixture) {
      await db.run('ROLLBACK;');
      return res.status(404).json({ error: `La luminaria con código ${code} no está registrada en el inventario.` });
    }

    // Determine final crew_id
    // If not provided in request, check if already assigned to a crew, else default to NULL/None
    const finalCrewId = crew_id || fixture.crew_id;
    if (!finalCrewId) {
      await db.run('ROLLBACK;');
      return res.status(400).json({
        error: `La luminaria ${code} no tiene una cuadrilla asignada. Asigne la luminaria a una cuadrilla primero.`
      });
    }

    // Insert installation log
    const dateStr = installed_at || new Date().toISOString();
    await db.run(
      `INSERT INTO installations (fixture_code, crew_id, operator_name, lat, lng, installed_at, status_at_install, notes, photo_before, photo_after)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, finalCrewId, operator_name || null, lat, lng, dateStr, status, notes || '', photo_before || null, photo_after || null]
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
      installed_at: dateStr,
      photo_before: photo_before || null,
      photo_after: photo_after || null
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
  const { crew_id, lat, lng, pole_type, lamp_type, zone_type, notes } = req.body;

  if (!lat || !lng || !lamp_type) {
    return res.status(400).json({ error: 'Faltan parámetros requeridos (lat, lng, lamp_type).' });
  }

  try {
    const countRow = await db.get('SELECT COUNT(*) as count FROM poles');
    const poleCode = `PST-${String((countRow.count || 0) + 1).padStart(5, '0')}`;
    const isoDate = new Date().toISOString();

    const result = await db.run(`
      INSERT INTO poles (pole_code, crew_id, lat, lng, pole_type, lamp_type, zone_type, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      poleCode,
      crew_id || null,
      lat,
      lng,
      pole_type || 'Concreto',
      lamp_type,
      zone_type || 'Urbana',
      notes || '',
      isoDate
    ]);

    res.status(201).json({
      message: 'Poste censado correctamente.',
      id: result.lastID,
      pole_code: poleCode,
      lat,
      lng,
      lamp_type,
      zone_type: zone_type || 'Urbana',
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

// SPA Fallback: Send index.html for all non-API GET requests
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api/')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

