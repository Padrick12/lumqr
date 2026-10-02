const path = require('path');
const fs = require('fs');

let sectoresData = null;
try {
  const jsonPath = path.join(__dirname, '../../client/src/data/sectores-lerdo.json');
  if (fs.existsSync(jsonPath)) {
    sectoresData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
} catch (err) {
  console.warn('Warning: Could not load sectores-lerdo.json for zone classification:', err.message);
}

function isPointInPolygon(lat, lng, vs) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getSectorName(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !sectoresData) return null;
  for (const feature of sectoresData.features || []) {
    if (!feature.geometry || feature.geometry.type !== 'Polygon') continue;
    const rawCoords = feature.geometry.coordinates[0];
    const coords = rawCoords.map(c => [c[1], c[0]]);
    if (isPointInPolygon(lat, lng, coords)) {
      return feature.properties.name || null;
    }
  }
  return null;
}

function isRuralSector(sectorName) {
  if (!sectorName) return false;
  if (/San Nicol[áa]s|Vicente Su[aá]rez|Vallecillos|Villa de Guadalupe|Villa Ju[áa]rez|Francisco Villa|Graseros|Picard[íi]as|Nazareno/i.test(sectorName)) return true;
  const isUrbanColonia = /Colonia|Ampliaci|Villa Jard[íi]n|Zona Centro|Fraccionamiento|Jardines|Magisterial|Samaniego|Rosales|Altas|Sarabia|Brisas|Sacramento|Rueda|Fierro|Quintas|Cerrada|Residencial|Valle|Laureles|Sauces|Reina|Jerusalem|Ed[ée]n|Cambio|Constituci[óo]n|Mayagoitia|Parque|Lomita/i.test(sectorName);
  return !isUrbanColonia;
}

function classifyZone(lat, lng, notes = '', explicitZone = null) {
  if (explicitZone && ['Urbana', 'Rural', 'Trayectos Seguros'].includes(explicitZone)) {
    return explicitZone;
  }

  const numLat = Number(lat);
  const numLng = Number(lng);

  // Geographic boundary rule for Lerdo rural sectors:
  // Points south/west of Lerdo urban core (Graceros, Picardías, Nazareno, Villa Juárez: lat < 25.48 or lng < -103.56) are Rural.
  if (numLat && numLng && (numLat < 25.48 || numLng < -103.56)) {
    return 'Rural';
  }

  const sectorName = getSectorName(numLat, numLng);
  if (sectorName) {
    return isRuralSector(sectorName) ? 'Rural' : 'Urbana';
  }

  // Fallback check on notes keyword if coordinates fall outside defined sector polygons
  const notesLower = (notes || '').toLowerCase();
  if (/graceros|graseros|villa ju[áa]rez|francisco villa|sacramento|picard[íi]as|san jacinto|el rayo|la luz|goma|loma|nazareno|rural/i.test(notesLower)) {
    return 'Rural';
  }

  return 'Urbana';
}

module.exports = {
  classifyZone,
  getSectorName,
  isRuralSector
};
