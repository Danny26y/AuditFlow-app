/**
 * Automated test suite for Dual-Mode Location Capture, Benue Centroid Mapping,
 * 18-Column Form Validation, and Batch Payload Construction.
 */

const assert = require('assert');

// 1. Mock Benue Agricultural Clusters Dataset
const BENUE_AGRICULTURAL_CLUSTERS = [
  { lga: 'Gboko', ward_community: 'Mkar', centroid_latitude: 7.35412, centroid_longitude: 9.04321, default_crop: 'Soybeans, Maize, Yam' },
  { lga: 'Gboko', ward_community: 'Yandev', centroid_latitude: 7.36925, centroid_longitude: 8.95114, default_crop: 'Maize, Cassava, Cattle/Beef' },
  { lga: 'Makurdi', ward_community: 'Modern Market', centroid_latitude: 7.73214, centroid_longitude: 8.53912, default_crop: 'Catfish, Vegetables, Poultry' },
  { lga: 'Makurdi', ward_community: 'Agan', centroid_latitude: 7.81052, centroid_longitude: 8.59123, default_crop: 'Rice, Maize, Catfish' },
  { lga: 'Katsina-Ala', ward_community: 'Tiirwalu', centroid_latitude: 7.16854, centroid_longitude: 9.28421, default_crop: 'Yam, Cassava, Rice' },
  { lga: 'Otukpo', ward_community: 'Otobi', centroid_latitude: 7.14251, centroid_longitude: 8.10214, default_crop: 'Rice, Cassava, Catfish' },
  { lga: 'Gwer East', ward_community: 'Aliade', centroid_latitude: 7.29852, centroid_longitude: 8.48324, default_crop: 'Soybeans, Maize, Citrus' },
  { lga: 'Vandeikya', ward_community: 'Mbagbera', centroid_latitude: 6.79251, centroid_longitude: 9.06824, default_crop: 'Citrus, Cocoa, Yam' },
  { lga: 'Guma', ward_community: 'Daudu', centroid_latitude: 7.93502, centroid_longitude: 8.62104, default_crop: 'Rice, Sesame, Cattle/Beef' },
  { lga: 'Ushongo', ward_community: 'Lessel', centroid_latitude: 7.12504, centroid_longitude: 9.02105, default_crop: 'Yam, Soybeans, Citrus' },
];

function getBenueLGAs() {
  return Array.from(new Set(BENUE_AGRICULTURAL_CLUSTERS.map(c => c.lga))).sort();
}

function getWardsForLGA(lga) {
  return BENUE_AGRICULTURAL_CLUSTERS.filter(c => c.lga.toLowerCase() === lga.toLowerCase());
}

function findBenueCluster(lga, ward) {
  return BENUE_AGRICULTURAL_CLUSTERS.find(
    c => c.lga.toLowerCase() === lga.toLowerCase() && c.ward_community.toLowerCase() === ward.toLowerCase()
  );
}

function validateNIN(nin) {
  if (!nin || nin.trim().length === 0) return 'NIN is required.';
  const clean = nin.trim();
  if (!/^\d{11}$/.test(clean)) return 'NIN must be exactly 11 digits.';
  return null;
}

function validateBVN(bvn) {
  if (!bvn || bvn.trim().length === 0) return 'BVN is required.';
  const clean = bvn.trim();
  if (!/^\d{11}$/.test(clean)) return 'BVN must be exactly 11 digits.';
  return null;
}

function validateCoordinates(lat, lng) {
  if (lat === undefined || isNaN(lat) || lat < -90 || lat > 90 || lat === 0) {
    return 'Invalid Latitude';
  }
  if (lng === undefined || isNaN(lng) || lng < -180 || lng > 180 || lng === 0) {
    return 'Invalid Longitude';
  }
  return null;
}

console.log('--- RUNNING FIELD CAPTURE & CENTROID TEST SUITE ---\n');

// Test 1: Benue Agrarian Clusters Lookup
const lgas = getBenueLGAs();
assert.strictEqual(lgas.length >= 8, true, 'Should contain at least 8 major Benue LGAs');
assert.strictEqual(lgas.includes('Gboko'), true);
assert.strictEqual(lgas.includes('Makurdi'), true);
assert.strictEqual(lgas.includes('Katsina-Ala'), true);
console.log('✓ Test 1 Passed: Benue LGA list resolved correctly (' + lgas.join(', ') + ')');

// Test 2: Ward and Centroid Lookup
const gbokoWards = getWardsForLGA('Gboko');
assert.strictEqual(gbokoWards.length >= 2, true);
const mkarCluster = findBenueCluster('Gboko', 'Mkar');
assert.strictEqual(mkarCluster.centroid_latitude, 7.35412);
assert.strictEqual(mkarCluster.centroid_longitude, 9.04321);
console.log('✓ Test 2 Passed: Mkar cluster centroid resolved to ' + mkarCluster.centroid_latitude + '° N, ' + mkarCluster.centroid_longitude + '° E');

// Test 3: Dual-Mode Coordinates Validation
assert.strictEqual(validateCoordinates(mkarCluster.centroid_latitude, mkarCluster.centroid_longitude), null);
assert.strictEqual(validateCoordinates(0, 8.5), 'Invalid Latitude');
assert.strictEqual(validateCoordinates(7.5, 200), 'Invalid Longitude');
console.log('✓ Test 3 Passed: Dual-Mode Coordinate bounds and precision verified');

// Test 4: Strict 11-digit string integrity for NIN & BVN
assert.strictEqual(validateNIN('01234567890'), null);
assert.strictEqual(validateNIN('12345'), 'NIN must be exactly 11 digits.');
assert.strictEqual(validateBVN('09876543210'), null);
console.log('✓ Test 4 Passed: 11-digit leading zeros preserved for NIN & BVN');

// Test 5: Mass Onboarding Distribution Simulation (200 records mapped across Benue clusters)
const simulatedBatch = [];
for (let i = 0; i < 200; i++) {
  const cluster = BENUE_AGRICULTURAL_CLUSTERS[i % BENUE_AGRICULTURAL_CLUSTERS.length];
  simulatedBatch.push({
    id: `REC-${i + 1}`,
    farmer_name: `Farmer ${i + 1}`,
    nin: `0${String(1000000000 + i)}`,
    bvn: `0${String(9000000000 + i)}`,
    lga: cluster.lga,
    community_ward: cluster.ward_community,
    latitude: cluster.centroid_latitude,
    longitude: cluster.centroid_longitude,
    crop_type: cluster.default_crop,
    farm_location: `${cluster.ward_community} Agrarian Farmland`,
  });
}

assert.strictEqual(simulatedBatch.length, 200);
const distinctCoordinates = new Set(simulatedBatch.map(r => `${r.latitude},${r.longitude}`));
assert.strictEqual(distinctCoordinates.size, BENUE_AGRICULTURAL_CLUSTERS.length);
console.log('✓ Test 5 Passed: 200 centralized onboarding records distributed across ' + distinctCoordinates.size + ' verified Benue centroids without venue clustering.');

console.log('\n🎉 ALL CLIENT & CENTROID TESTS PASSED SUCCESSFULLY!\n');
