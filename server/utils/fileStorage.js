const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const EVIDENCES_DIR = path.join(UPLOADS_DIR, 'evidences');

// Ensure uploads directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(EVIDENCES_DIR)) {
  fs.mkdirSync(EVIDENCES_DIR, { recursive: true });
}

/**
 * Saves a base64 encoded image to a physical .jpg file on NVMe SSD
 * @param {string} base64Str - The base64 string (with or without data:image/jpeg;base64, prefix)
 * @param {string} subFolder - Subfolder under /uploads/ (default: 'evidences')
 * @returns {string} Relative URL path to serve statically (e.g. '/uploads/evidences/foto_123.jpg')
 */
function saveBase64Image(base64Str, subFolder = 'evidences') {
  if (!base64Str || typeof base64Str !== 'string') return base64Str;
  
  // If it's already a static URL path (e.g. starting with '/uploads/'), return as is
  if (base64Str.startsWith('/uploads/') || base64Str.startsWith('http')) {
    return base64Str;
  }

  // Check if string contains base64 image signature
  if (!base64Str.includes('data:image') && base64Str.length < 500) {
    return base64Str;
  }

  try {
    const targetDir = path.join(UPLOADS_DIR, subFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Extract raw base64 data
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let imageBuffer;
    
    if (matches && matches.length === 3) {
      imageBuffer = Buffer.from(matches[2], 'base64');
    } else {
      imageBuffer = Buffer.from(base64Str, 'base64');
    }

    const fileName = `foto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, imageBuffer);
    
    // Return relative URL for web client
    return `/uploads/${subFolder}/${fileName}`;
  } catch (error) {
    console.error('Error saving base64 image to NVMe disk:', error);
    return base64Str; // Fallback to raw string if saving fails
  }
}

module.exports = {
  saveBase64Image,
  UPLOADS_DIR,
  EVIDENCES_DIR
};
