import React from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lock,
  RotateCcw,
  MapPin,
  FileSpreadsheet,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { FarmerRecordOut } from '../types/dashboard';
import { BENUE_LGAS, COMMON_CROPS } from '../constants/benueData';

interface FarmerTableProps {
  records: FarmerRecordOut[];
  totalCount: number;
  limit: number;
  offset: number;
  searchQuery: string;
  selectedLga: string;
  selectedCrop: string;
  loading: boolean;
  onSearchChange: (q: string) => void;
  onLgaChange: (lga: string) => void;
  onCropChange: (crop: string) => void;
  onPageChange: (newOffset: number) => void;
  onSelectFarmer: (farmer: FarmerRecordOut) => void;
  onResetFilters: () => void;
}

export const FarmerTable: React.FC<FarmerTableProps> = ({
  records,
  totalCount,
  limit,
  offset,
  searchQuery,
  selectedLga,
  selectedCrop,
  loading,
  onSearchChange,
  onLgaChange,
  onCropChange,
  onPageChange,
  onSelectFarmer,
  onResetFilters,
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, totalCount);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md dark:shadow-2xl overflow-hidden flex flex-col transition-colors duration-200">
      {/* Header & Filter Controls */}
      <div className="p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Master Farmer Registry</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {totalCount.toLocaleString()} Total Records
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                18-Column Verified Field Demographics & Biometrics
              </p>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative min-w-[240px] flex-1 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search Name, NIN, BVN, LGA..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs"
                >
                  ×
                </button>
              )}
            </div>

            {/* LGA Dropdown */}
            <select
              value={selectedLga}
              onChange={(e) => onLgaChange(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">All LGAs (Benue)</option>
              {BENUE_LGAS.map((lga) => (
                <option key={lga} value={lga}>
                  {lga}
                </option>
              ))}
            </select>

            {/* Crop Dropdown */}
            <select
              value={selectedCrop}
              onChange={(e) => onCropChange(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">All Produce Types</option>
              {COMMON_CROPS.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>

            {/* Reset Filters */}
            {(searchQuery || selectedLga || selectedCrop) && (
              <button
                onClick={onResetFilters}
                title="Reset all search filters"
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 text-xs flex items-center space-x-1 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="text-[11px] hidden sm:inline">Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto min-h-[300px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-[2px] z-20 flex items-center justify-center">
            <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent"></div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Loading Registry Records...</span>
            </div>
          </div>
        )}

        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
          <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Farmer Name</th>
              <th className="py-3 px-4">Strict 11-Digit NIN</th>
              <th className="py-3 px-4">Strict 11-Digit BVN</th>
              <th className="py-3 px-4">LGA & Ward</th>
              <th className="py-3 px-4">Crop / Volume</th>
              <th className="py-3 px-4">Est. Yield</th>
              <th className="py-3 px-4">GPS / Biometrics</th>
              <th className="py-3 px-4">SEC Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {records.length === 0 && !loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
                  <div className="max-w-xs mx-auto space-y-2">
                    <AlertCircle className="h-8 w-8 text-slate-400 dark:text-slate-600 mx-auto" />
                    <p className="font-semibold text-slate-700 dark:text-slate-400">No matching farmer records found</p>
                    <p className="text-[11px] text-slate-500">
                      Try adjusting your search criteria or synchronize new records from the mobile field capture app.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              records.map((farmer) => {
                const name = farmer.farmer_name || farmer.full_legal_name || 'Anonymous Farmer';
                const hasGps =
                  farmer.latitude !== null &&
                  farmer.latitude !== undefined &&
                  farmer.longitude !== null &&
                  farmer.longitude !== undefined;
                const hasBio = Boolean(farmer.biometric_template_hash || farmer.fingerprint_hash);

                return (
                  <tr
                    key={farmer.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectFarmer(farmer)}
                  >
                    {/* Farmer Name */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {farmer.cooperative_name || 'Independent Primary Producer'}
                      </div>
                    </td>

                    {/* Strict 11-Digit NIN with leading zeros */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-emerald-700 dark:text-emerald-400 tracking-wider bg-slate-100 dark:bg-slate-950/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 inline-block font-semibold">
                        {farmer.nin}
                      </div>
                    </td>

                    {/* Strict 11-Digit BVN with leading zeros */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-teal-700 dark:text-teal-300 tracking-wider bg-slate-100 dark:bg-slate-950/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 inline-block font-semibold">
                        {farmer.bvn}
                      </div>
                    </td>

                    {/* LGA & Ward */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{farmer.lga}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                        {farmer.community_ward || farmer.ward || 'General Ward'}
                      </div>
                    </td>

                    {/* Crop & Farm Size */}
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {farmer.crop_type || 'Mixed Agronomic'}
                      </span>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {farmer.farm_size_hectares ? `${farmer.farm_size_hectares} ha` : '—'}
                      </div>
                    </td>

                    {/* Estimated Yield */}
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {farmer.estimated_yield_tonnes ? `${farmer.estimated_yield_tonnes} T` : '—'}
                    </td>

                    {/* GPS & Biometric Badge */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span
                          title={hasGps ? `GPS: ${farmer.latitude}, ${farmer.longitude}` : 'No GPS'}
                          className={`p-1 rounded ${
                            hasGps
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                          }`}
                        >
                          <MapPin className="h-3 w-3" />
                        </span>
                        <span
                          title={hasBio ? '64-Char SHA-256 Biometric Hash Captured' : 'No Biometrics'}
                          className={`p-1 rounded ${
                            hasBio
                              ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                          }`}
                        >
                          <Hash className="h-3 w-3" />
                        </span>
                      </div>
                    </td>

                    {/* SEC Digital Lock */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <Lock className="h-2.5 w-2.5" />
                        <span>SEC LOCKED</span>
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectFarmer(farmer);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition shadow-sm"
                      >
                        <Eye className="h-3 w-3" />
                        <span>18-Col View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-900 dark:text-white">{rangeStart}</span> to{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{rangeEnd}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-white">{totalCount.toLocaleString()}</span> entries
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={offset === 0 || loading}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 font-mono text-slate-700 dark:text-slate-300">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(offset + limit)}
            disabled={offset + limit >= totalCount || loading}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
