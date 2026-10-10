import test from 'node:test';
import assert from 'node:assert/strict';

import { translations } from '../src/lib/data/translations.ts';
import { ALL_BLOCKS } from '../src/lib/data/bundelkhand.ts';
import { parsePointCoordinates, hasValidCoordinates } from '../src/lib/mappers/blockMapper.ts';

test('Map Explorer translations dictionary contains all PART 2 simplified terminology', () => {
  // English simplified terminology checks
  assert.equal(translations.en['explorer.title'], 'Explore the Map');
  assert.equal(translations.en['explorer.subtitle'], 'View groundwater and environmental information on the map');
  assert.equal(translations.en['explorer.activeLayer'], 'Map Information');
  assert.equal(translations.en['layer.risk'], 'Groundwater Status');
  assert.equal(translations.en['layer.grace'], 'Satellite Water Storage Estimate');
  assert.equal(translations.en['layer.rainfall'], 'Rainfall Difference');
  assert.equal(translations.en['layer.wells'], 'Groundwater Monitoring Wells');
  assert.equal(translations.en['layer.sentinel'], 'Satellite Vegetation Information');
  assert.equal(translations.en['explorer.blockDetails'], 'Block Details');
  assert.equal(translations.en['explorer.sampleStressScore'], 'Sample Stress Score');
  assert.equal(translations.en['explorer.possibleDrivers'], 'Possible Contributing Factors');
  assert.equal(translations.en['explorer.importantInfo'], 'Important Information');
  assert.equal(translations.en['explorer.suggestSolution'], 'Suggest a Solution');
  assert.equal(translations.en['explorer.previewAdvisory'], 'Preview Advisory');
  assert.equal(translations.en['explorer.mapGuide'], 'Map Guide');
  assert.equal(translations.en['severity.severe'], 'High Concern');
  assert.equal(translations.en['severity.watch'], 'Needs Checking');
  assert.equal(translations.en['severity.normal'], 'No Flag in Sample Data');

  // Hindi easy terminology checks
  assert.equal(translations.hi['explorer.title'], 'नक्शे पर जानकारी देखें');
  assert.equal(translations.hi['explorer.subtitle'], 'नक्शे पर भूजल और पर्यावरण की जानकारी देखें');
  assert.equal(translations.hi['explorer.activeLayer'], 'नक्शे पर जानकारी');
  assert.equal(translations.hi['layer.risk'], 'भूजल की स्थिति');
  assert.equal(translations.hi['layer.grace'], 'उपग्रह से जल भंडारण का अनुमान');
  assert.equal(translations.hi['layer.rainfall'], 'बारिश में अंतर');
  assert.equal(translations.hi['layer.wells'], 'भूजल मापन कुएँ');
  assert.equal(translations.hi['layer.sentinel'], 'उपग्रह से वनस्पति की जानकारी');
  assert.equal(translations.hi['explorer.blockDetails'], 'ब्लॉक की जानकारी');
  assert.equal(translations.hi['explorer.sampleStressScore'], 'नमूना तनाव स्कोर');
  assert.equal(translations.hi['explorer.possibleDrivers'], 'संभावित कारण');
  assert.equal(translations.hi['explorer.importantInfo'], 'ज़रूरी जानकारी');
  assert.equal(translations.hi['explorer.suggestSolution'], 'उपाय सुझाएँ');
  assert.equal(translations.hi['explorer.previewAdvisory'], 'सूचना का पूर्वावलोकन');
  assert.equal(translations.hi['explorer.mapGuide'], 'नक्शे की जानकारी');
  assert.equal(translations.hi['severity.severe'], 'अधिक ध्यान देने की ज़रूरत');
  assert.equal(translations.hi['severity.watch'], 'जाँच ज़रूरी');
  assert.equal(translations.hi['severity.normal'], 'नमूना डेटा में कोई चेतावनी नहीं');
});

test('PART 4 consolidated sample data notice text is present in both languages', () => {
  assert.equal(
    translations.en['explorer.sampleNotice'],
    'Sample data — these values are for demonstration only and are not verified groundwater measurements.'
  );
  assert.equal(
    translations.hi['explorer.sampleNotice'],
    'नमूना जानकारी — ये आँकड़े केवल प्रदर्शन के लिए हैं, सत्यापित भूजल माप नहीं हैं।'
  );
});

test('All pilot demonstration blocks have valid geographic coordinates', () => {
  assert.equal(ALL_BLOCKS.length, 12);
  for (const block of ALL_BLOCKS) {
    assert.ok(Array.isArray(block.coordinates), `Block ${block.id} must have coordinates array`);
    assert.equal(block.coordinates.length, 2);
    assert.ok(hasValidCoordinates(block.coordinates as [number, number]), `Block ${block.id} coordinates must be valid`);
  }
});

test('District filtering preserves block markers correctly', () => {
  const jhansiBlocks = ALL_BLOCKS.filter(b => b.districtId === 'dist_jhansi');
  assert.equal(jhansiBlocks.length, 2);
  for (const block of jhansiBlocks) {
    assert.equal(block.districtName, 'Jhansi');
    assert.ok(hasValidCoordinates(block.coordinates as [number, number]));
  }
});

test('Invalid or missing coordinates are safely rejected', () => {
  assert.equal(hasValidCoordinates(null), false);
  assert.equal(hasValidCoordinates([999, 999] as any), false);
  assert.equal(parsePointCoordinates('CORRUPTED'), null);
});
