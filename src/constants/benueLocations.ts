/**
 * Pre-loaded offline dataset of Benue State LGAs, Agricultural Wards, and Farming Communities.
 * Used for town-hall / cluster centroid assignment during centralized onboarding sessions.
 */

export interface BenueCluster {
  lga: string;
  ward_community: string;
  default_crop: string;
  centroid_latitude: number;
  centroid_longitude: number;
  description: string;
}

export const BENUE_AGRICULTURAL_CLUSTERS: BenueCluster[] = [
  // 1. GBOKO LGA (Soybeans, Citrus & Grain Hub)
  {
    lga: 'Gboko',
    ward_community: 'Mkar',
    default_crop: 'Soybeans, Maize, Yam',
    centroid_latitude: 7.35412,
    centroid_longitude: 9.04321,
    description: 'Mkar Hill Agrarian Basin — High-density soybean & cereal cluster',
  },
  {
    lga: 'Gboko',
    ward_community: 'Yandev',
    default_crop: 'Maize, Cassava, Cattle/Beef',
    centroid_latitude: 7.36925,
    centroid_longitude: 8.95114,
    description: 'Yandev Agricultural Research & Livestock Corridor',
  },
  {
    lga: 'Gboko',
    ward_community: 'Gboko South',
    default_crop: 'Citrus, Soybeans, Poultry',
    centroid_latitude: 7.30124,
    centroid_longitude: 8.99451,
    description: 'Gboko South Citrus Orchards & Mixed Farms',
  },
  {
    lga: 'Gboko',
    ward_community: 'Gboko East',
    default_crop: 'Yam, Maize, Poultry (Layers)',
    centroid_latitude: 7.33250,
    centroid_longitude: 9.02105,
    description: 'Gboko East Grain Belt & Commercial Poultry Hub',
  },
  {
    lga: 'Gboko',
    ward_community: 'Mbaa-Gba',
    default_crop: 'Cassava, Groundnuts, Maize',
    centroid_latitude: 7.28402,
    centroid_longitude: 9.05204,
    description: 'Mbaa-Gba Tuber & Legume Production Cluster',
  },

  // 2. MAKURDI LGA (River Basin, Rice, Catfish & Poultry)
  {
    lga: 'Makurdi',
    ward_community: 'Modern Market',
    default_crop: 'Catfish, Vegetables, Poultry',
    centroid_latitude: 7.73214,
    centroid_longitude: 8.53912,
    description: 'Makurdi Urban Agriculture & Intensive Aquaculture Zone',
  },
  {
    lga: 'Makurdi',
    ward_community: 'Agan',
    default_crop: 'Rice, Maize, Catfish',
    centroid_latitude: 7.81052,
    centroid_longitude: 8.59123,
    description: 'Agan River Basin Floodplain Rice Scheme',
  },
  {
    lga: 'Makurdi',
    ward_community: 'North Bank',
    default_crop: 'Vegetables, Catfish, Poultry',
    centroid_latitude: 7.75401,
    centroid_longitude: 8.52805,
    description: 'North Bank Riverine Vegetable & Fish Farming Zone',
  },
  {
    lga: 'Makurdi',
    ward_community: 'Fiidi',
    default_crop: 'Rice, Soybeans, Maize',
    centroid_latitude: 7.70204,
    centroid_longitude: 8.61402,
    description: 'Fiidi Lowland Rice & Oilseed Cluster',
  },
  {
    lga: 'Makurdi',
    ward_community: 'Kanshio',
    default_crop: 'Cassava, Maize, Vegetables',
    centroid_latitude: 7.68502,
    centroid_longitude: 8.51204,
    description: 'Kanshio South Peri-Urban Cassava Farms',
  },

  // 3. KATSINA-ALA LGA (Premier National Yam & Sesame Capital)
  {
    lga: 'Katsina-Ala',
    ward_community: 'Tiirwalu',
    default_crop: 'Yam, Cassava, Rice',
    centroid_latitude: 7.16854,
    centroid_longitude: 9.28421,
    description: 'Tiirwalu Heavy Tuber & Yam Production Belt',
  },
  {
    lga: 'Katsina-Ala',
    ward_community: 'Utange',
    default_crop: 'Yam, Soybeans, Maize',
    centroid_latitude: 7.22105,
    centroid_longitude: 9.34102,
    description: 'Utange Commercial Yam & Cereal Cluster',
  },
  {
    lga: 'Katsina-Ala',
    ward_community: 'Iwar',
    default_crop: 'Yam, Sesame, Groundnuts',
    centroid_latitude: 7.14201,
    centroid_longitude: 9.22904,
    description: 'Iwar Beniseed / Sesame Seed & Tuber Hub',
  },
  {
    lga: 'Katsina-Ala',
    ward_community: 'Mbacher',
    default_crop: 'Rice, Yam, Cattle/Beef',
    centroid_latitude: 7.10502,
    centroid_longitude: 9.31205,
    description: 'Mbacher River Basin & Pastoralist Zone',
  },

  // 4. OTUKPO LGA (Rice, Cassava, Maize & Small Ruminants)
  {
    lga: 'Otukpo',
    ward_community: 'Otobi',
    default_crop: 'Rice, Cassava, Catfish',
    centroid_latitude: 7.14251,
    centroid_longitude: 8.10214,
    description: 'Otobi River Basin Rice & Cassava Processing Zone',
  },
  {
    lga: 'Otukpo',
    ward_community: 'Upu',
    default_crop: 'Maize, Yam, Goats',
    centroid_latitude: 7.21503,
    centroid_longitude: 8.18302,
    description: 'Upu Upland Grain & Small Ruminant Cluster',
  },
  {
    lga: 'Otukpo',
    ward_community: 'Otukpo Town',
    default_crop: 'Poultry, Vegetables, Pigs',
    centroid_latitude: 7.19425,
    centroid_longitude: 8.13251,
    description: 'Otukpo Central Agrarian Cooperative Secretariat',
  },
  {
    lga: 'Otukpo',
    ward_community: 'Allan',
    default_crop: 'Soybeans, Cassava, Maize',
    centroid_latitude: 7.24801,
    centroid_longitude: 8.09504,
    description: 'Allan Tuber & Oilseed Farming Belt',
  },

  // 5. GWER EAST LGA (Citrus & Soybean Core Hub)
  {
    lga: 'Gwer East',
    ward_community: 'Aliade',
    default_crop: 'Soybeans, Maize, Citrus',
    centroid_latitude: 7.29852,
    centroid_longitude: 8.48324,
    description: 'Aliade Central Citrus Orchards & Soybean Trading Hub',
  },
  {
    lga: 'Gwer East',
    ward_community: 'Ikpayongo',
    default_crop: 'Yam, Cassava, Cattle/Beef',
    centroid_latitude: 7.48102,
    centroid_longitude: 8.51405,
    description: 'Ikpayongo Yam Terminal & Livestock Transit Corridor',
  },
  {
    lga: 'Gwer East',
    ward_community: 'Shough',
    default_crop: 'Citrus, Soybeans, Maize',
    centroid_latitude: 7.24105,
    centroid_longitude: 8.42102,
    description: 'Shough Sweet Orange & Grain Cluster',
  },

  // 6. VANDEIKYA LGA (Highland Tree Crops, Citrus & Tubers)
  {
    lga: 'Vandeikya',
    ward_community: 'Mbagbera',
    default_crop: 'Citrus, Cocoa, Yam',
    centroid_latitude: 6.79251,
    centroid_longitude: 9.06824,
    description: 'Mbagbera Highland Tree Crops & Citrus Belt',
  },
  {
    lga: 'Vandeikya',
    ward_community: 'Mbakaange',
    default_crop: 'Cassava, Maize, Citrus',
    centroid_latitude: 6.74502,
    centroid_longitude: 9.02105,
    description: 'Mbakaange Cassava & Orange Production Hub',
  },
  {
    lga: 'Vandeikya',
    ward_community: 'Tsambe',
    default_crop: 'Rice, Yam, Soybeans',
    centroid_latitude: 6.81204,
    centroid_longitude: 9.11502,
    description: 'Tsambe River Valley Rice & Yam Farms',
  },
  {
    lga: 'Vandeikya',
    ward_community: 'Ningev',
    default_crop: 'Citrus, Oil Palm, Yam',
    centroid_latitude: 6.72105,
    centroid_longitude: 9.09804,
    description: 'Ningev Oil Palm & Citrus Plantation Cluster',
  },

  // 7. GUMA LGA (Benue River Lowland Rice & Sesame)
  {
    lga: 'Guma',
    ward_community: 'Daudu',
    default_crop: 'Rice, Sesame, Cattle/Beef',
    centroid_latitude: 7.93502,
    centroid_longitude: 8.62104,
    description: 'Daudu Floodplain Rice & Livestock Corridor',
  },
  {
    lga: 'Guma',
    ward_community: 'Gbajimba',
    default_crop: 'Rice, Catfish, Maize',
    centroid_latitude: 8.01205,
    centroid_longitude: 8.89502,
    description: 'Gbajimba River Port Fisheries & Swamp Rice Zone',
  },
  {
    lga: 'Guma',
    ward_community: 'Uvir',
    default_crop: 'Cassava, Yam, Sesame',
    centroid_latitude: 7.87401,
    centroid_longitude: 8.76205,
    description: 'Uvir Sesame & Tuber Production Cluster',
  },

  // 8. USHONGO LGA (Citrus, Yam & Groundnuts)
  {
    lga: 'Ushongo',
    ward_community: 'Lessel',
    default_crop: 'Yam, Soybeans, Citrus',
    centroid_latitude: 7.12504,
    centroid_longitude: 9.02105,
    description: 'Lessel Upland Agro-Ecological Tuber Zone',
  },
  {
    lga: 'Ushongo',
    ward_community: 'Mbaakaa',
    default_crop: 'Maize, Cassava, Goats',
    centroid_latitude: 7.08201,
    centroid_longitude: 8.97504,
    description: 'Mbaakaa Mixed Farming & Livestock Cluster',
  },
  {
    lga: 'Ushongo',
    ward_community: 'Utange',
    default_crop: 'Yam, Groundnuts, Citrus',
    centroid_latitude: 7.16402,
    centroid_longitude: 9.08205,
    description: 'Utange Groundnut & Sweet Orange Valley',
  },
];

/**
 * Returns a sorted unique list of all supported Benue LGAs.
 */
export function getBenueLGAs(): string[] {
  const lgas = Array.from(new Set(BENUE_AGRICULTURAL_CLUSTERS.map((c) => c.lga)));
  return lgas.sort();
}

/**
 * Returns all Agricultural Wards / Communities belonging to a given LGA.
 */
export function getWardsForLGA(lga: string): BenueCluster[] {
  return BENUE_AGRICULTURAL_CLUSTERS.filter(
    (c) => c.lga.trim().toLowerCase() === lga.trim().toLowerCase()
  );
}

/**
 * Finds the exact cluster entry for a given LGA and Ward combination.
 */
export function findBenueCluster(lga: string, ward: string): BenueCluster | undefined {
  return BENUE_AGRICULTURAL_CLUSTERS.find(
    (c) =>
      c.lga.trim().toLowerCase() === lga.trim().toLowerCase() &&
      c.ward_community.trim().toLowerCase() === ward.trim().toLowerCase()
  );
}
