export type SyncStatus = 'PENDING_SYNC' | 'SYNCED' | 'ERROR';

export interface FarmerRecord {
  id: string; // UUID v4 primary key
  agent_id: string;
  device_uuid: string;
  farmer_name: string;
  nin: string; // Strict 11-digit text string (leading zeros preserved)
  bvn: string; // Strict 11-digit text string (leading zeros preserved)
  phone_number: string;
  lga: string;
  community_ward: string;
  cooperative_name: string;
  crop_type: string;
  farm_size_hectares: number;
  estimated_yield_tonnes: number;
  farm_location?: string; // Physical farm location / landmark description / manual location
  latitude: number;
  longitude: number;
  biometric_template_hash: string;
  captured_at: string; // ISO-8601 UTC
  sync_status: SyncStatus;
  sync_error_message?: string | null;
}

export type FarmerInput = Omit<FarmerRecord, 'id' | 'captured_at' | 'sync_status' | 'sync_error_message'> & {
  id?: string;
  captured_at?: string;
  sync_status?: SyncStatus;
  sync_error_message?: string | null;
};

export interface DatabaseStats {
  total: number;
  pending: number;
  synced: number;
  error: number;
}

export interface SyncBatchPayload {
  batch_id: string;
  agent_id: string;
  timestamp: string;
  batch_size: number;
  records: FarmerRecord[];
}

export interface SyncBatchItemResult {
  id: string;
  status: 'SUCCESS' | 'ERROR';
  error_message?: string;
}

export interface SyncBatchResponse {
  batch_id: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  processed_count: number;
  success_count: number;
  error_count: number;
  synced_ids?: string[];
  results?: SyncBatchItemResult[];
  message?: string;
  audit_checksum?: string;
}

export type BluetoothConnectionState =
  | 'DISCONNECTED'
  | 'SCANNING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'SCANNING_FINGER'
  | 'ERROR';

export interface BluetoothDevice {
  id: string;
  name: string;
  rssi?: number;
  isConnected?: boolean;
}

export interface BiometricScanResult {
  templateHash: string; // 64-char hex SHA-256 fingerprint hash
  qualityScore: number; // 0 - 100 percentage
  timestamp: string; // ISO-8601 UTC
  rawBytesPreview?: string;
}

export interface SyncProgress {
  isSyncing: boolean;
  totalBatches: number;
  currentBatch: number;
  recordsInBatch: number;
  totalRecordsToSync: number;
  syncedCount: number;
  errorCount: number;
  lastError: string | null;
  lastSyncedAt: string | null;
}
