const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'lumqr.db');
const backupsDir = path.join(__dirname, 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

async function runBackup() {
  const dateStr = new Date().toISOString().split('T')[0];
  const backupPath = path.join(backupsDir, `lumqr_backup_${dateStr}.db`);

  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log(`[Disaster Recovery] Iniciando copia de seguridad en caliente hacia ${backupPath}...`);
    await db.run(`VACUUM INTO ?`, [backupPath]);
    console.log(`[Disaster Recovery] Backup generado con éxito: ${backupPath}`);

    // Eliminar respaldos antiguos (> 30 días)
    const files = fs.readdirSync(backupsDir);
    const now = Date.now();
    const maxAgeMs = 30 * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (file.startsWith('lumqr_backup_') && file.endsWith('.db')) {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
          console.log(`[Disaster Recovery] Backup antiguo eliminado: ${file}`);
        }
      }
    });

    await db.close();
  } catch (err) {
    console.error(`[Disaster Recovery] Error creando respaldo:`, err.message);
  }
}

runBackup();
