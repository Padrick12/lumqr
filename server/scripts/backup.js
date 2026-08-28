const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { dbPath } = require('../database');

const BACKUPS_DIR = path.join(__dirname, '../backups');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Creates a compressed gzip backup of lumqr.db
 * @returns {Promise<{success: boolean, filename: string, filepath: string, sizeBytes: number}>}
 */
function createDatabaseBackup() {
  return new Promise((resolve, reject) => {
    try {
      ensureBackupsDir();

      if (!fs.existsSync(dbPath)) {
        return reject(new Error(`Database file not found at ${dbPath}`));
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `lumqr_backup_${dateStr}_${timeStr}.db.gz`;
      const filepath = path.join(BACKUPS_DIR, filename);

      const gzip = zlib.createGzip();
      const input = fs.createReadStream(dbPath);
      const output = fs.createWriteStream(filepath);

      input.pipe(gzip).pipe(output);

      output.on('finish', () => {
        const stats = fs.statSync(filepath);
        pruneOldBackups(30); // Clean up backups older than 30 days
        resolve({
          success: true,
          filename,
          filepath,
          sizeBytes: stats.size,
          createdAt: now.toISOString()
        });
      });

      output.on('error', (err) => {
        console.error('Backup write stream error:', err);
        reject(err);
      });
    } catch (err) {
      console.error('Backup creation error:', err);
      reject(err);
    }
  });
}

/**
 * Removes backup files older than maxDays
 * @param {number} maxDays - Maximum age in days (default 30)
 */
function pruneOldBackups(maxDays = 30) {
  try {
    ensureBackupsDir();
    const files = fs.readdirSync(BACKUPS_DIR);
    const now = Date.now();
    const maxAgeMs = maxDays * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      if (file.endsWith('.db.gz')) {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          console.log(`Pruning old backup file: ${file}`);
          fs.unlinkSync(filePath);
        }
      }
    });
  } catch (err) {
    console.error('Error pruning old backups:', err);
  }
}

/**
 * Lists all existing database backups
 */
function listBackups() {
  ensureBackupsDir();
  const files = fs.readdirSync(BACKUPS_DIR);
  return files
    .filter(file => file.endsWith('.db.gz'))
    .map(file => {
      const filePath = path.join(BACKUPS_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        sizeBytes: stats.size,
        createdAt: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

module.exports = {
  createDatabaseBackup,
  pruneOldBackups,
  listBackups,
  BACKUPS_DIR
};
