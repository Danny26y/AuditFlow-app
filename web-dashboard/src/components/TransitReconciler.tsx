import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Scale,
  AlertTriangle,
  FileCheck,
  Lock,
  History,
  Sparkles,
  RefreshCw,
  Send,
} from 'lucide-react';
import { reconcileTransit } from '../services/api';
import {
  TransitReconciliationRequest,
  TransitReconciliationResponse,
} from '../types/dashboard';

interface ReconcileHistoryItem {
  request: TransitReconciliationRequest;
  response: TransitReconciliationResponse;
  timestamp: string;
}

export const TransitReconciler: React.FC = () => {
  const [formData, setFormData] = useState<TransitReconciliationRequest>({
    batch_ticket_id: 'BATCH-2026-MKD-089A',
    soft_id_token: 'SOFT-ID-992384',
    enumerator_id: 'ENUM-MKD-BRB-01',
    mass_field: 5000.0,
    mass_store: 5000.0,
    weighbridge_operator_id: 'OP-WHD-04',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TransitReconciliationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReconcileHistoryItem[]>([]);

  // Live calculation of Delta M
  const liveDeltaM = Math.round((Number(formData.mass_field) - Number(formData.mass_store)) * 1000) / 1000;

  const presets = [
    {
      name: 'Clean Transit (Zero Leakage)',
      description: 'Delta M = 0kg — Perfect mass balance',
      data: {
        batch_ticket_id: 'BATCH-2026-MKD-090A',
        soft_id_token: 'SOFT-ID-100293',
        enumerator_id: 'ENUM-GBK-01',
        mass_field: 4500.0,
        mass_store: 4500.0,
        weighbridge_operator_id: 'OP-WHD-01',
      },
    },
    {
      name: 'Minor Extraction Alert',
      description: 'Delta M = 45kg — Product leakage in transit',
      data: {
        batch_ticket_id: 'BATCH-2026-KAT-042B',
        soft_id_token: 'SOFT-ID-883921',
        enumerator_id: 'ENUM-KAT-03',
        mass_field: 5000.0,
        mass_store: 4955.0,
        weighbridge_operator_id: 'OP-WHD-02',
      },
    },
    {
      name: 'Severe Breach (Extraction Alert)',
      description: 'Delta M = 280kg — Critical theft alert',
      data: {
        batch_ticket_id: 'BATCH-2026-OTK-112C',
        soft_id_token: 'SOFT-ID-772109',
        enumerator_id: 'ENUM-OTK-05',
        mass_field: 8000.0,
        mass_store: 7720.0,
        weighbridge_operator_id: 'OP-WHD-04',
      },
    },
    {
      name: 'Inbound Overweight (Overshoot)',
      description: 'Delta M = -35kg — Calibration variance',
      data: {
        batch_ticket_id: 'BATCH-2026-GWR-019D',
        soft_id_token: 'SOFT-ID-339182',
        enumerator_id: 'ENUM-GWR-02',
        mass_field: 3500.0,
        mass_store: 3535.0,
        weighbridge_operator_id: 'OP-WHD-03',
      },
    },
  ];

  const handleApplyPreset = (presetData: TransitReconciliationRequest) => {
    setFormData(presetData);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await reconcileTransit({
        ...formData,
        mass_field: Number(formData.mass_field),
        mass_store: Number(formData.mass_store),
      });
      setResult(res);
      setHistory((prev) => [
        {
          request: { ...formData },
          response: res,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to process transit reconciliation request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Description Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Scale className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              SEC Supply Chain Mass-Balance & Transit Leakage Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Enforces strict weighbridge mass-balance verification: ΔM = Mass(field) - Mass(store). Automatically flags unauthorized extractions and generates unalterable audit trails under SEC ISA regulatory frameworks.
          </p>
        </div>

        {/* Live Equation Pill */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            Current Delta M
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white">{formData.mass_field} kg</span>
            <span className="text-slate-500">-</span>
            <span className="font-bold text-white">{formData.mass_store} kg</span>
            <span className="text-slate-500">=</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-xs ${
                liveDeltaM === 0
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : liveDeltaM > 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {liveDeltaM > 0 ? `+${liveDeltaM}` : liveDeltaM} kg
            </span>
          </div>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>Quick Scenario Presets:</span>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {presets.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(p.data)}
              className="text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition space-y-1 group"
            >
              <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                {p.name}
              </div>
              <div className="text-[11px] text-slate-400">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <FileCheck className="h-4 w-4 text-emerald-400" />
              <span>Weighbridge Manifest Verification Form</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              POST /api/v1/security/reconcile-manifest
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Batch Ticket ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Batch Ticket ID
                </label>
                <input
                  type="text"
                  value={formData.batch_ticket_id}
                  onChange={(e) =>
                    setFormData({ ...formData, batch_ticket_id: e.target.value })
                  }
                  required
                  placeholder="BATCH-2026-MKD-089A"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Soft ID Token */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Soft ID Token
                </label>
                <input
                  type="text"
                  value={formData.soft_id_token}
                  onChange={(e) =>
                    setFormData({ ...formData, soft_id_token: e.target.value })
                  }
                  required
                  placeholder="SOFT-ID-992384"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Enumerator ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Field Enumerator Anchor ID
                </label>
                <input
                  type="text"
                  value={formData.enumerator_id}
                  onChange={(e) =>
                    setFormData({ ...formData, enumerator_id: e.target.value })
                  }
                  required
                  placeholder="ENUM-MKD-BRB-01"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Weighbridge Operator ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Weighbridge Operator ID
                </label>
                <input
                  type="text"
                  value={formData.weighbridge_operator_id}
                  onChange={(e) =>
                    setFormData({ ...formData, weighbridge_operator_id: e.target.value })
                  }
                  required
                  placeholder="OP-WHD-04"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Mass Field */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="block text-xs font-semibold text-emerald-400 mb-1">
                  Initial Farm Gate Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={formData.mass_field}
                  onChange={(e) =>
                    setFormData({ ...formData, mass_field: parseFloat(e.target.value) || 0 })
                  }
                  required
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Scanned at regional cluster aggregation node
                </span>
              </div>

              {/* Mass Store */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="block text-xs font-semibold text-teal-300 mb-1">
                  Warehouse Weighbridge Arrival (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={formData.mass_store}
                  onChange={(e) =>
                    setFormData({ ...formData, mass_store: parseFloat(e.target.value) || 0 })
                  }
                  required
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Scanned at central silo terminal
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Executing Verification...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Run SEC Reconciliation Check</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Verdict & Audit Response Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col justify-between min-h-[380px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span>Reconciliation Verdict</span>
                </h3>
                {result && (
                  <span className="font-mono text-[11px] text-slate-400">
                    Log: {result.audit_checksum}
                  </span>
                )}
              </div>

              {!result && !loading && (
                <div className="py-16 text-center text-slate-500 space-y-3">
                  <Scale className="h-12 w-12 text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400 font-medium">
                    Submit the form or pick a preset to evaluate weighbridge manifest leakage.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Evaluates Delta M = Mass_Field - Mass_Store in accordance with SEC ISA 2025 \ IV(40).
                  </p>
                </div>
              )}

              {loading && (
                <div className="py-16 text-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-400 border-t-transparent mx-auto"></div>
                  <p className="text-xs text-slate-400">
                    Processing cryptographic reconciliation and evaluating mass variance...
                  </p>
                </div>
              )}

              {result && !loading && (
                <div className="space-y-4 animate-fade-in">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-start space-x-3.5 ${
                      !result.is_flagged
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : result.severity === 'WARNING'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {!result.is_flagged ? (
                      <ShieldCheck className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="h-6 w-6 text-rose-400 flex-shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold uppercase tracking-wider">
                          {result.status}
                        </span>
                        {result.severity && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-950/80 border border-current">
                            {result.severity}
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-200">
                        {result.details || result.incident_details}
                      </p>
                    </div>
                  </div>

                  {/* Variance Metrics Breakdown */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Mass Variance (Delta M):</span>
                      <span
                        className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${
                          result.mass_variance === 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {result.mass_variance > 0
                          ? `+${result.mass_variance} kg (Loss)`
                          : result.mass_variance < 0
                          ? `${result.mass_variance} kg (Overage)`
                          : '0.000 kg (Balanced)'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-850 pt-2">
                      <span className="text-slate-400">Audit Checksum ID:</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {result.audit_checksum}
                      </span>
                    </div>

                    {result.regulatory_context && (
                      <div className="border-t border-slate-850 pt-2">
                        <span className="text-[11px] text-amber-400/90 font-medium block">
                          ⚖️ {result.regulatory_context}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Audit Integrity Note */}
            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center space-x-1.5">
              <Lock className="h-3 w-3 text-slate-400" />
              <span>Immutable cryptographic audit logs recorded in master session.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Session Reconciliations History */}
      {history.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <History className="h-3.5 w-3.5 text-slate-400" />
            <span>Session Audit History ({history.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Batch ID</th>
                  <th className="py-2 px-3">Field Mass</th>
                  <th className="py-2 px-3">Store Mass</th>
                  <th className="py-2 px-3">Delta M</th>
                  <th className="py-2 px-3">Verdict</th>
                  <th className="py-2 px-3">Audit Checksum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-850/50">
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{h.timestamp}</td>
                    <td className="py-2 px-3 font-mono font-semibold text-white">{h.request.batch_ticket_id}</td>
                    <td className="py-2 px-3 font-mono">{h.request.mass_field} kg</td>
                    <td className="py-2 px-3 font-mono">{h.request.mass_store} kg</td>
                    <td className="py-2 px-3 font-mono font-bold">
                      <span
                        className={
                          h.response.mass_variance === 0 ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {h.response.mass_variance > 0 ? `+${h.response.mass_variance}` : h.response.mass_variance} kg
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          !h.response.is_flagged
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {h.response.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                      {h.response.audit_checksum}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
