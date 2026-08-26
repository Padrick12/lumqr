const { initializeDatabase } = require('./database');

async function resetTestData() {
  try {
    const db = await initializeDatabase();
    await db.run('BEGIN TRANSACTION;');

    await db.run('DELETE FROM installations');
    await db.run('DELETE FROM fixtures');
    await db.run('DELETE FROM batches');
    await db.run('DELETE FROM poles');

    // Reset auto-increment counters for SQLite
    try {
      await db.run("DELETE FROM sqlite_sequence WHERE name IN ('batches', 'installations', 'poles')");
    } catch(e) {
      console.log('sqlite_sequence note:', e.message);
    }

    await db.run('COMMIT;');

    const batchCount = await db.get('SELECT COUNT(*) as c FROM batches');
    const fixtureCount = await db.get('SELECT COUNT(*) as c FROM fixtures');
    const instCount = await db.get('SELECT COUNT(*) as c FROM installations');
    const poleCount = await db.get('SELECT COUNT(*) as c FROM poles');

    console.log('Database reset complete!');
    console.log('Batches:', batchCount.c);
    console.log('Fixtures:', fixtureCount.c);
    console.log('Installations:', instCount.c);
    console.log('Poles:', poleCount.c);
  } catch (err) {
    console.error('Error resetting database:', err);
  }
}

resetTestData();
