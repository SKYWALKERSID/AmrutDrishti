const fs = require('fs');
const path = require('path');

if (!fs.existsSync('scripts')) {
  fs.mkdirSync('scripts');
}

const geojsonPath = path.join('data', 'sources', 'admin-boundaries', 'pilot_subdistricts_soi_2025.geojson');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));

const blockMap = {
  'BIJAWAR': '3783',
  'RAJNAGAR': '3788',
  'BALDEOGARH': '4027',
  'JATARA': '4028',
  'PALERA': '4030',
  'TIKAMGARH': '4032'
};

let sql = '-- ============================================================================\n';
sql += '-- ACT-05: Remote PostGIS Polygons Ingestion Script\n';
sql += '-- Populates public.administrative_units.geom column with Survey of India (SOI) 2025\n';
sql += '-- GeoJSON MultiPolygon coordinates for the 6 monitored priority blocks in Central India (Madhya Pradesh).\n';
sql += '-- ============================================================================\n\n';

geojson.features.forEach((feat) => {
  const name = feat.properties.subdistrictName;
  const unitId = blockMap[name];
  if (!unitId) return;

  let geomObj = feat.geometry;
  if (geomObj.type === 'Polygon') {
    geomObj = {
      type: 'MultiPolygon',
      coordinates: [geomObj.coordinates]
    };
  }

  const geomJsonStr = JSON.stringify(geomObj).replace(/'/g, "''");
  sql += `-- Block: ${name} (${unitId}) - Area: ${feat.properties.geodesicAreaKm2} sq km\n`;
  sql += `UPDATE public.administrative_units\n`;
  sql += `SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('${geomJsonStr}'), 4326))\n`;
  sql += `WHERE unit_id = '${unitId}';\n\n`;
});

sql += '-- Verification query\n';
sql += 'SELECT unit_id, name, ST_GeometryType(geom) AS geom_type, ST_NumGeometries(geom) AS num_geoms FROM public.administrative_units WHERE geom IS NOT NULL;\n';

fs.writeFileSync('scripts/populate_remote_polygons.sql', sql, 'utf8');
console.log('Successfully wrote scripts/populate_remote_polygons.sql');
