import {
  FarmerRecordOut,
  PaginatedRecordsResponse,
  StatsSummaryResponse,
  SystemHealth,
  TransitReconciliationRequest,
  TransitReconciliationResponse,
  FarmerFilters,
} from '../types/dashboard';

const STORAGE_KEY = 'auditflow_backend_url';
export const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_BASE_URL;
  }
  return DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem(STORAGE_KEY, cleanUrl || DEFAULT_API_BASE_URL);
    window.dispatchEvent(new Event('auditflow_api_url_changed'));
  }
}

/**
 * Health check endpoint: GET /health
 */
export async function checkHealth(): Promise<SystemHealth> {
  const base = getApiBaseUrl();
  const startTime = Date.now();
  try {
    const response = await fetch(`${base}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Health check failed with HTTP ${response.status}`);
    }
    const data = await response.json();
    return { ...data, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      status: 'offline',
      service: 'AuditFlow Field Capture Backend',
      endpoints: {},
      latencyMs,
    };
  }
}

/**
 * High-level KPI metrics: GET /api/v1/ingest/stats/summary
 */
export async function fetchStatsSummary(): Promise<StatsSummaryResponse> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/v1/ingest/stats/summary`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stats summary: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Paginated and filtered farmer records: GET /api/v1/ingest/records
 */
export async function fetchRecords(filters: FarmerFilters = {}): Promise<PaginatedRecordsResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();

  if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
  if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
  if (filters.search) params.append('search', filters.search.trim());
  if (filters.lga) params.append('lga', filters.lga.trim());
  if (filters.crop_type) params.append('crop_type', filters.crop_type.trim());
  if (filters.agent_id) params.append('agent_id', filters.agent_id.trim());
  if (filters.is_locked !== undefined) params.append('is_locked', String(filters.is_locked));

  const url = `${base}/api/v1/ingest/records?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch farmer records: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Single farmer 18-column record: GET /api/v1/ingest/records/{id_or_nin}
 */
export async function fetchRecordDetail(idOrNin: string): Promise<FarmerRecordOut> {
  const base = getApiBaseUrl();
  const encoded = encodeURIComponent(idOrNin.trim());
  const response = await fetch(`${base}/api/v1/ingest/records/${encoded}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch farmer record for '${idOrNin}': HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Get direct CSV export download URL
 */
export function getExportCsvUrl(): string {
  const base = getApiBaseUrl();
  return `${base}/api/v1/ingest/records/export/csv`;
}

/**
 * Trigger CSV export download
 */
export async function downloadCsvExport(): Promise<void> {
  const url = getExportCsvUrl();
  const res = await fetch(url, {
    method: 'GET',
  });
  if (!res.ok) {
    throw new Error(`CSV Export failed: HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `farmer_registry_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * SEC Supply Chain Transit Reconciler: POST /api/v1/security/reconcile-manifest
 */
export async function reconcileTransit(
  payload: TransitReconciliationRequest
): Promise<TransitReconciliationResponse> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/v1/security/reconcile-manifest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Note: 200 is Verified, 202 is System Flagged
  if (!response.ok && response.status !== 202) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.detail || `Reconciliation failed with HTTP ${response.status}`);
  }

  return response.json();
}
