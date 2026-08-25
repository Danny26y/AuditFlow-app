import React, { useState } from 'react';
import {
  X,
  Lock,
  User,
  MapPin,
  Sprout,
  ShieldCheck,
  Fingerprint,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { FarmerRecordOut } from '../types/dashboard';

interface FarmerDetailModalProps {
  farmer: FarmerRecordOut | null;
  onClose: () => void;
}

export const FarmerDetailModal: React.FC<FarmerDetailModalProps> = ({ farmer, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!farmer) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const name = farmer.farmer_name || farmer.full_legal_name || 'Primary Producer';
  const bioHash = farmer.biometric_template_hash || farmer.fingerprint_hash || 'None Captured';
  const hasGps =
    farmer.latitude !== null &&
    farmer.latitude !== undefined &&
    farmer.longitude !== null &&
    farmer.longitude !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-2xl h-full flex flex-col shadow-2xl overflow-hidden transition-colors duration-200">
        {/* Modal Header */}
        <div className="p-5 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{name}</h3>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <Lock className="h-2.5 w-2.5" />
                  <span>SEC LOCKED</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                18-Column Certified Farmer Record · ID: #{farmer.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Scrollable 18 Columns */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* SEC Cryptographic Seal Box */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-slate-50 to-teal-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/30 border border-emerald-500/30 flex items-start space-x-3 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                SEC ISA Digital Lock Active
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                This record is cryptographically anchored in the master registry. The 11-digit NIN and BVN strings have been validated and preserved under SEC ISA compliance rules.
              </p>
              {farmer.audit_checksum && (
                <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  Audit Checksum: {farmer.audit_checksum}
                </p>
              )}
            </div>
          </div>

          {/* Section 1: Identification & Anti-Fraud Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>1. Identification & Anti-Fraud</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* NIN */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1 text-[11px]">
                  <span>National ID (NIN)</span>
                  <button
                    onClick={() => copyToClipboard(farmer.nin, 'nin')}
                    className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    {copiedField === 'nin' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                  {farmer.nin}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">11-digit text (zeros preserved)</span>
              </div>

              {/* BVN */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1 text-[11px]">
                  <span>Bank Verification (BVN)</span>
                  <button
                    onClick={() => copyToClipboard(farmer.bvn, 'bvn')}
                    className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400"
                  >
                    {copiedField === 'bvn' ? <Check className="h-3 w-3 text-teal-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="font-mono text-sm font-bold text-teal-700 dark:text-teal-300 tracking-wider">
                  {farmer.bvn}
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">11-digit text (zeros preserved)</span>
              </div>

              {/* Phone */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Primary Phone</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{farmer.phone_number || farmer.primary_phone || '—'}</span>
              </div>

              {/* Mother's Maiden Name */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Mother's Maiden Name (Anti-Fraud)</span>
                <span className="text-slate-800 dark:text-slate-200">{farmer.mothers_maiden_name || 'Protected / Verified'}</span>
              </div>

              {/* Next of Kin */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 sm:col-span-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Next of Kin / Alternate Contact</span>
                <span className="text-slate-800 dark:text-slate-200">{farmer.next_of_kin || 'Registered in Family File'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Geographic & Cooperative Demographics */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>2. Geographic Context & Cooperative</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">State & LGA</span>
                <span className="font-bold text-slate-900 dark:text-white">{farmer.state || 'Benue'}, {farmer.lga}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Ward / Community</span>
                <span className="text-slate-800 dark:text-slate-200">{farmer.community_ward || farmer.ward || 'General Ward'}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 sm:col-span-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Cooperative Name</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">{farmer.cooperative_name || 'Independent Producer'}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 sm:col-span-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">GPS Coordinates & Landmark</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-800 dark:text-slate-300">
                    {hasGps ? `${farmer.latitude}, ${farmer.longitude}` : 'No GPS Tagged'}
                  </span>
                  {hasGps && (
                    <a
                      href={`https://www.google.com/maps?q=${farmer.latitude},${farmer.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 font-semibold"
                    >
                      <span>Open Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {farmer.farm_location && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">{farmer.farm_location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Agricultural Production & Volume Metrics */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <Sprout className="h-3.5 w-3.5 text-lime-600 dark:text-lime-400" />
              <span>3. Asset & Production Metrics</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Primary Produce</span>
                <span className="font-bold text-slate-900 dark:text-white">{farmer.crop_type || farmer.value_chain_type || '—'}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Cultivated Land</span>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                  {farmer.farm_size_hectares ? `${farmer.farm_size_hectares} ha` : '—'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Estimated Yield</span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-300 text-sm">
                  {farmer.estimated_yield_tonnes ? `${farmer.estimated_yield_tonnes} tonnes` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Biometrics & Audit Metadata */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <Fingerprint className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>4. Biometrics & Field Audit Metadata</span>
            </h4>

            <div className="space-y-3 text-xs">
              {/* 64-char SHA-256 Biometric Hash */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5 text-[11px]">
                  <span className="flex items-center space-x-1">
                    <Fingerprint className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>64-Char SHA-256 Biometric Minutiae Hash</span>
                  </span>
                  <button
                    onClick={() => copyToClipboard(bioHash, 'bio')}
                    className="text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center space-x-1 text-[10px]"
                  >
                    {copiedField === 'bio' ? (
                      <>
                        <Check className="h-3 w-3 text-cyan-500" />
                        <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Hash</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="font-mono text-xs text-cyan-800 dark:text-cyan-300 break-all bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80">
                  {bioHash}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Enumerator / Field Agent ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{farmer.agent_id || 'System Ingest'}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Device Hardware UUID</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] truncate block">
                    {farmer.device_uuid || 'Standard Ingestion Terminal'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Captured At (UTC)</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {farmer.captured_at ? new Date(farmer.captured_at).toUTCString() : '—'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Server Ingestion Time</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">
                    {farmer.created_at ? new Date(farmer.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            UUID: {farmer.record_uuid || `REC-${farmer.id}`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
