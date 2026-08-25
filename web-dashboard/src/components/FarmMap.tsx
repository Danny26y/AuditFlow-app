import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Lock,
  Layers,
  Sprout,
  ExternalLink,
  RotateCcw,
  Navigation,
} from 'lucide-react';
import { FarmerRecordOut } from '../types/dashboard';
import { BENUE_AGRICULTURAL_CLUSTERS } from '../constants/benueData';

// Benue State geographic center
const BENUE_CENTER: [number, number] = [7.3256, 8.9984];
const DEFAULT_ZOOM = 8;

// Create custom SVG markers for Leaflet to prevent bundler 404s
function createFarmerIcon(cropType?: string | null): L.DivIcon {
  const crop = (cropType || '').toLowerCase();
  let color = '#10b981'; // default emerald

  if (crop.includes('rice')) color = '#06b6d4'; // cyan
  else if (crop.includes('yam') || crop.includes('cassava')) color = '#f59e0b'; // amber
  else if (crop.includes('soybean')) color = '#84cc16'; // lime
  else if (crop.includes('citrus') || crop.includes('orange')) color = '#fb923c'; // orange
  else if (crop.includes('catfish') || crop.includes('fish')) color = '#38bdf8'; // sky
  else if (crop.includes('cattle') || crop.includes('poultry')) color = '#a855f7'; // purple

  return L.divIcon({
    className: 'custom-farmer-pin',
    html: `
      <div style="
        position: relative;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          background-color: ${color};
          border: 2px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
        "></div>
        <div style="
          position: relative;
          z-index: 10;
          width: 8px;
          height: 8px;
          background-color: #0f172a;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function createClusterCentroidIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-cluster-pin',
    html: `
      <div style="
        background: rgba(15, 23, 42, 0.9);
        color: #34d399;
        border: 1.5px solid #10b981;
        border-radius: 9999px;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.5px;
        white-space: nowrap;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      ">
        📍 ${name}
      </div>
    `,
    iconSize: [80, 20],
    iconAnchor: [40, 10],
  });
}

// Controller to smoothly pan & zoom map programmatically
function MapController({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

interface FarmMapProps {
  records: FarmerRecordOut[];
  selectedLga: string;
  onSelectLga: (lga: string) => void;
  onSelectFarmer: (farmer: FarmerRecordOut) => void;
}

export const FarmMap: React.FC<FarmMapProps> = ({
  records,
  selectedLga,
  onSelectLga,
  onSelectFarmer,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>(BENUE_CENTER);
  const [mapZoom, setMapZoom] = useState<number>(DEFAULT_ZOOM);
  const [showClusterCentroids, setShowClusterCentroids] = useState<boolean>(true);
  const [tileLayerType, setTileLayerType] = useState<'dark' | 'satellite' | 'street'>('dark');

  // Filter records with valid GPS coordinates
  const validGpsRecords = useMemo(() => {
    return records.filter(
      (r) =>
        r.latitude !== null &&
        r.latitude !== undefined &&
        !isNaN(Number(r.latitude)) &&
        r.longitude !== null &&
        r.longitude !== undefined &&
        !isNaN(Number(r.longitude)) &&
        Number(r.latitude) >= 4 &&
        Number(r.latitude) <= 14 &&
        Number(r.longitude) >= 3 &&
        Number(r.longitude) <= 15
    );
  }, [records]);

  // When selectedLga changes, pan to that LGA's centroid
  useEffect(() => {
    if (selectedLga) {
      const cluster = BENUE_AGRICULTURAL_CLUSTERS.find(
        (c) => c.lga.toLowerCase() === selectedLga.toLowerCase()
      );
      if (cluster) {
        setMapCenter([cluster.centroid_latitude, cluster.centroid_longitude]);
        setMapZoom(11);
      }
    }
  }, [selectedLga]);

  const handleResetView = () => {
    onSelectLga('');
    setMapCenter(BENUE_CENTER);
    setMapZoom(DEFAULT_ZOOM);
  };

  const handleSelectCentroid = (cluster: (typeof BENUE_AGRICULTURAL_CLUSTERS)[0]) => {
    onSelectLga(cluster.lga);
    setMapCenter([cluster.centroid_latitude, cluster.centroid_longitude]);
    setMapZoom(11);
  };

  // Map Tile Providers
  const tileUrls = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite:
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  return (
    <div className="relative rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col h-[520px]">
      {/* Top Map Header & Controls */}
      <div className="p-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <span>Geospatial Farmer Registry Map</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {validGpsRecords.length} Geotagged Plot{validGpsRecords.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Benue State Agricultural Basins & Farm Plots
            </p>
          </div>
        </div>

        {/* LGA Cluster Quick-Filter Pills */}
        <div className="flex items-center space-x-2">
          {/* Tile Layer Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setTileLayerType('dark')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                tileLayerType === 'dark'
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setTileLayerType('satellite')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                tileLayerType === 'satellite'
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setTileLayerType('street')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                tileLayerType === 'street'
                  ? 'bg-slate-800 text-emerald-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Street
            </button>
          </div>

          {/* Toggle Centroid Labels */}
          <button
            onClick={() => setShowClusterCentroids(!showClusterCentroids)}
            title="Toggle agricultural cluster centroid labels"
            className={`p-1.5 rounded-lg border text-xs flex items-center space-x-1 transition ${
              showClusterCentroids
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="text-[11px] hidden sm:inline">Hubs</span>
          </button>

          {/* Reset View Button */}
          <button
            onClick={handleResetView}
            title="Reset map view to Benue state"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs flex items-center space-x-1 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-[11px] hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Cluster Navigation Bar */}
      <div className="bg-slate-950/80 px-3 py-1.5 border-b border-slate-800/80 flex items-center space-x-1.5 overflow-x-auto text-[11px] scrollbar-thin">
        <span className="text-slate-500 flex items-center space-x-1 flex-shrink-0">
          <Navigation className="h-3 w-3" />
          <span>Quick Hubs:</span>
        </span>
        {BENUE_AGRICULTURAL_CLUSTERS.map((c, i) => (
          <button
            key={i}
            onClick={() => handleSelectCentroid(c)}
            className={`flex-shrink-0 px-2 py-0.5 rounded-md font-medium transition ${
              selectedLga.toLowerCase() === c.lga.toLowerCase()
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            {c.lga} ({c.ward_community})
          </button>
        ))}
      </div>

      {/* Map Body */}
      <div className="relative flex-1 w-full">
        <MapContainer
          center={BENUE_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            url={tileUrls[tileLayerType]}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Render Cluster Centroid Labels */}
          {showClusterCentroids &&
            BENUE_AGRICULTURAL_CLUSTERS.map((cluster, idx) => (
              <Marker
                key={`cluster-${idx}`}
                position={[cluster.centroid_latitude, cluster.centroid_longitude]}
                icon={createClusterCentroidIcon(`${cluster.lga} · ${cluster.ward_community}`)}
                eventHandlers={{
                  click: () => handleSelectCentroid(cluster),
                }}
              >
                <Popup>
                  <div className="p-3 max-w-xs text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-sm mb-1">
                      <Sprout className="h-4 w-4" />
                      <span>{cluster.lga} Agricultural Hub</span>
                    </div>
                    <p className="text-slate-300 font-semibold mb-1">
                      Ward: {cluster.ward_community}
                    </p>
                    <p className="text-slate-400 text-[11px] mb-2">{cluster.description}</p>
                    <div className="text-[11px] bg-slate-950 p-2 rounded border border-slate-800 text-slate-300">
                      <span className="text-emerald-400 font-semibold">Primary Crops:</span>{' '}
                      {cluster.default_crop}
                    </div>
                    <button
                      onClick={() => onSelectLga(cluster.lga)}
                      className="mt-2.5 w-full py-1 px-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[11px] transition text-center"
                    >
                      Filter Farmers in {cluster.lga}
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Render Farmer Pins */}
          {validGpsRecords.map((farmer) => {
            const lat = Number(farmer.latitude);
            const lng = Number(farmer.longitude);
            const farmerName = farmer.farmer_name || farmer.full_legal_name || 'Anonymous Farmer';
            const icon = createFarmerIcon(farmer.crop_type);

            return (
              <Marker
                key={`farmer-${farmer.id}-${farmer.record_uuid || farmer.nin}`}
                position={[lat, lng]}
                icon={icon}
              >
                <Popup>
                  <div className="p-3 max-w-xs text-slate-100 text-xs">
                    <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                      <div>
                        <h4 className="font-bold text-sm text-white">{farmerName}</h4>
                        <p className="text-[11px] text-slate-400">
                          {farmer.community_ward || farmer.ward || 'Community'}, {farmer.lga}
                        </p>
                      </div>
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <Lock className="h-2.5 w-2.5" />
                        <span>SEC LOCKED</span>
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px] mb-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Crop / Asset:</span>
                        <span className="font-semibold text-emerald-300">
                          {farmer.crop_type || 'Mixed Crops'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Farm Size:</span>
                        <span className="font-mono text-white">
                          {farmer.farm_size_hectares ? `${farmer.farm_size_hectares} ha` : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Est. Yield:</span>
                        <span className="font-mono text-white">
                          {farmer.estimated_yield_tonnes
                            ? `${farmer.estimated_yield_tonnes} tonnes`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">NIN:</span>
                        <span className="font-mono text-slate-300 tracking-wider">
                          {farmer.nin}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cooperative:</span>
                        <span className="text-slate-200 truncate max-w-[140px]">
                          {farmer.cooperative_name || 'Independent'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectFarmer(farmer)}
                      className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Inspect 18-Col Record</span>
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 p-2.5 rounded-xl text-[10px] space-y-1 shadow-xl max-w-[170px] hidden md:block">
          <div className="font-bold text-slate-300 mb-1 flex items-center space-x-1">
            <Sprout className="h-3 w-3 text-emerald-400" />
            <span>Produce Markers</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-lime-500"></span>
              <span>Soybeans</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
              <span>Rice</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>Yam/Cassava</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400"></span>
              <span>Citrus</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400"></span>
              <span>Aquaculture</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-400"></span>
              <span>Livestock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
