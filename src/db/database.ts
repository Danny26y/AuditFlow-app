import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import uuid from 'react-native-uuid';
import { FarmerInput, FarmerRecord, DatabaseStats, SyncStatus } from '../types';

const DB_NAME = 'field_capture.db';
const WEB_STORAGE_KEY = 'field_capture_farmer_registry_db';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;
let isWebPlatform = Platform.OS === 'web';
let webInMemoryStore: FarmerRecord[] = [];

export class DatabaseConstraintError extends Error {
  field?: 'nin' | 'bvn' | 'biometric_template_hash' | 'id';
  constructor(message: string, field?: 'nin' | 'bvn' | 'biometric_template_hash' | 'id') {
    super(message);
    this.name = 'DatabaseConstraintError';
    this.field = field;
  }
}

// ----------------------------------------------------
// Web Fallback Storage Engine (Browser Instant Preview)
// ----------------------------------------------------
function getWebStore(): FarmerRecord[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(WEB_STORAGE_KEY);
      if (raw) {
        webInMemoryStore = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('localStorage read error, using in-memory store:', e);
    }
  }
  return webInMemoryStore;
}

function saveWebStore(records: FarmerRecord[]): void {
  webInMemoryStore = records;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('localStorage write error:', e);
    }
  }
}

/**
 * Internal single-flight initialization function for SQLite on Android / iOS.
 */
async function initDatabaseInternal(): Promise<SQLite.SQLiteDatabase | null> {
  if (isWebPlatform) {
    getWebStore();
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);

    // Configure WAL mode for fast concurrency and reliability on Android/iOS
    try {
      await db.execAsync('PRAGMA journal_mode = WAL;');
    } catch (e) {
      // Ignore WAL pragma if restricted
    }

    // Create table with individual clean execAsync commands
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS farmer_registry (
        id TEXT PRIMARY KEY NOT NULL,
        agent_id TEXT NOT NULL,
        device_uuid TEXT NOT NULL,
        farmer_name TEXT NOT NULL,
        nin TEXT NOT NULL UNIQUE,
        bvn TEXT NOT NULL UNIQUE,
        phone_number TEXT NOT NULL,
        lga TEXT NOT NULL,
        community_ward TEXT NOT NULL,
        cooperative_name TEXT NOT NULL,
        crop_type TEXT NOT NULL,
        farm_size_hectares REAL NOT NULL,
        estimated_yield_tonnes REAL NOT NULL,
        farm_location TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        biometric_template_hash TEXT NOT NULL UNIQUE,
        captured_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING_SYNC',
        sync_error_message TEXT
      );
    `);

    // Create indexes individually
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_farmer_registry_sync_status ON farmer_registry(sync_status);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_farmer_registry_captured_at ON farmer_registry(captured_at);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_farmer_registry_nin ON farmer_registry(nin);');
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_farmer_registry_bvn ON farmer_registry(bvn);');

    // Graceful migration for existing SQLite databases
    try {
      await db.execAsync('ALTER TABLE farmer_registry ADD COLUMN farm_location TEXT;');
    } catch (migErr) {
      // Column already exists, ignore
    }

    dbInstance = db;
    return db;
  } catch (err) {
    console.warn('Native SQLite init failed, falling back to storage adapter:', err);
    isWebPlatform = true;
    getWebStore();
    return null;
  }
}

/**
 * Initializes the SQLite database on native Android/iOS (or web adapter in browser).
 * Uses a promise lock to prevent concurrent initialization race conditions.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (!dbInitPromise) {
    dbInitPromise = initDatabaseInternal();
  }
  return await dbInitPromise;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase | null> {
  if (isWebPlatform) {
    return null;
  }
  if (dbInstance) {
    return dbInstance;
  }
  return await initDatabase();
}

/**
 * Inserts a new 18-column farmer demographic record.
 * Strict preservation of 11-digit NIN and BVN strings with leading zeros.
 * Enforces UNIQUE constraints for NIN, BVN, and Biometric Hash.
 */
export async function insertFarmerRecord(input: FarmerInput): Promise<FarmerRecord> {
  const id = input.id ? String(input.id).trim() : uuid.v4().toString();
  const captured_at = input.captured_at ? String(input.captured_at).trim() : new Date().toISOString();
  const sync_status: SyncStatus = input.sync_status || 'PENDING_SYNC';
  const sync_error_message = input.sync_error_message ? String(input.sync_error_message) : null;
  const farm_location = input.farm_location ? String(input.farm_location).trim() : '';

  // Strict string preservation for NIN and BVN
  const nin = String(input.nin || '').trim();
  const bvn = String(input.bvn || '').trim();
  const biometric_template_hash = String(input.biometric_template_hash || '').trim().toLowerCase();

  const record: FarmerRecord = {
    id,
    agent_id: String(input.agent_id || '').trim(),
    device_uuid: String(input.device_uuid || '').trim(),
    farmer_name: String(input.farmer_name || '').trim(),
    nin,
    bvn,
    phone_number: String(input.phone_number || '').trim(),
    lga: String(input.lga || '').trim(),
    community_ward: String(input.community_ward || '').trim(),
    cooperative_name: String(input.cooperative_name || '').trim(),
    crop_type: String(input.crop_type || '').trim(),
    farm_size_hectares: Number(input.farm_size_hectares) || 0,
    estimated_yield_tonnes: Number(input.estimated_yield_tonnes) || 0,
    farm_location,
    latitude: Number(input.latitude) || 0,
    longitude: Number(input.longitude) || 0,
    biometric_template_hash,
    captured_at,
    sync_status,
    sync_error_message,
  };

  // 1. Web Platform Implementation
  if (isWebPlatform) {
    const store = getWebStore();

    // Check unique constraints
    if (store.some((r) => r.nin === nin)) {
      throw new DatabaseConstraintError(`Farmer with NIN "${nin}" is already registered.`, 'nin');
    }
    if (store.some((r) => r.bvn === bvn)) {
      throw new DatabaseConstraintError(`Farmer with BVN "${bvn}" is already registered.`, 'bvn');
    }
    if (store.some((r) => r.biometric_template_hash === biometric_template_hash)) {
      throw new DatabaseConstraintError(
        'This biometric fingerprint hash is already registered to another farmer.',
        'biometric_template_hash'
      );
    }
    if (store.some((r) => r.id === id)) {
      throw new DatabaseConstraintError(`Record ID collision: "${id}".`, 'id');
    }

    store.unshift(record);
    saveWebStore(store);
    return record;
  }

  // 2. Native SQLite Platform Implementation (Android APK / iOS)
  const db = await getDatabase();
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    // Pass strictly validated, non-undefined parameters
    await db.runAsync(
      `INSERT INTO farmer_registry (
        id, agent_id, device_uuid, farmer_name, nin, bvn,
        phone_number, lga, community_ward, cooperative_name,
        crop_type, farm_size_hectares, estimated_yield_tonnes,
        farm_location, latitude, longitude, biometric_template_hash, captured_at,
        sync_status, sync_error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.agent_id,
        record.device_uuid,
        record.farmer_name,
        record.nin,
        record.bvn,
        record.phone_number,
        record.lga,
        record.community_ward,
        record.cooperative_name,
        record.crop_type,
        record.farm_size_hectares,
        record.estimated_yield_tonnes,
        record.farm_location || '',
        record.latitude,
        record.longitude,
        record.biometric_template_hash,
        record.captured_at,
        record.sync_status,
        record.sync_error_message || '',
      ]
    );

    return record;
  } catch (error: any) {
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes('UNIQUE constraint failed: farmer_registry.nin') || errorMsg.includes('farmer_registry.nin')) {
      throw new DatabaseConstraintError(`Farmer with NIN "${nin}" is already registered.`, 'nin');
    }
    if (errorMsg.includes('UNIQUE constraint failed: farmer_registry.bvn') || errorMsg.includes('farmer_registry.bvn')) {
      throw new DatabaseConstraintError(`Farmer with BVN "${bvn}" is already registered.`, 'bvn');
    }
    if (
      errorMsg.includes('UNIQUE constraint failed: farmer_registry.biometric_template_hash') ||
      errorMsg.includes('farmer_registry.biometric_template_hash')
    ) {
      throw new DatabaseConstraintError(
        'This biometric fingerprint hash is already registered to another farmer.',
        'biometric_template_hash'
      );
    }
    if (errorMsg.includes('UNIQUE constraint failed: farmer_registry.id')) {
      throw new DatabaseConstraintError(`Record ID collision: "${id}".`, 'id');
    }

    throw error;
  }
}

/**
 * Retrieves a single farmer record by primary key UUID.
 */
export async function getFarmerById(id: string): Promise<FarmerRecord | null> {
  if (isWebPlatform) {
    const store = getWebStore();
    return store.find((r) => r.id === id) ?? null;
  }

  const db = await getDatabase();
  if (!db) return null;
  const row = await db.getFirstAsync<FarmerRecord>('SELECT * FROM farmer_registry WHERE id = ?', [String(id || '')]);
  return row ?? null;
}

/**
 * Retrieves all registered farmer records sorted by capture date descending.
 */
export async function getAllFarmers(limit: number = 100, offset: number = 0): Promise<FarmerRecord[]> {
  if (isWebPlatform) {
    const store = getWebStore();
    return store.slice(offset, offset + limit);
  }

  const db = await getDatabase();
  if (!db) return [];
  return await db.getAllAsync<FarmerRecord>(
    'SELECT * FROM farmer_registry ORDER BY captured_at DESC LIMIT ? OFFSET ?',
    [Number(limit) || 100, Number(offset) || 0]
  );
}

/**
 * Retrieves records that need synchronization ('PENDING_SYNC' or 'ERROR').
 */
export async function getPendingSyncRecords(limit?: number): Promise<FarmerRecord[]> {
  if (isWebPlatform) {
    const store = getWebStore();
    const pending = store.filter((r) => r.sync_status === 'PENDING_SYNC' || r.sync_status === 'ERROR');
    return limit && limit > 0 ? pending.slice(0, limit) : pending;
  }

  const db = await getDatabase();
  if (!db) return [];
  if (limit && limit > 0) {
    return await db.getAllAsync<FarmerRecord>(
      `SELECT * FROM farmer_registry 
       WHERE sync_status IN ('PENDING_SYNC', 'ERROR') 
       ORDER BY captured_at ASC LIMIT ?`,
      [Number(limit)]
    );
  }
  return await db.getAllAsync<FarmerRecord>(
    `SELECT * FROM farmer_registry 
     WHERE sync_status IN ('PENDING_SYNC', 'ERROR') 
     ORDER BY captured_at ASC`
  );
}

/**
 * Updates the sync status of a single record.
 */
export async function updateSyncStatus(
  id: string,
  status: SyncStatus,
  errorMessage: string | null = null
): Promise<void> {
  if (isWebPlatform) {
    const store = getWebStore();
    const idx = store.findIndex((r) => r.id === id);
    if (idx !== -1) {
      store[idx] = {
        ...store[idx],
        sync_status: status,
        sync_error_message: errorMessage ?? null,
      };
      saveWebStore(store);
    }
    return;
  }

  const db = await getDatabase();
  if (!db) return;
  await db.runAsync('UPDATE farmer_registry SET sync_status = ?, sync_error_message = ? WHERE id = ?', [
    String(status || 'PENDING_SYNC'),
    errorMessage ? String(errorMessage) : '',
    String(id || ''),
  ]);
}

/**
 * Atomically updates the sync status of multiple records within a transaction.
 */
export async function updateBatchSyncStatus(
  ids: string[],
  status: SyncStatus,
  errorMessage: string | null = null
): Promise<void> {
  if (!ids || ids.length === 0) return;

  if (isWebPlatform) {
    const store = getWebStore();
    const idSet = new Set(ids);
    for (let i = 0; i < store.length; i++) {
      if (idSet.has(store[i].id)) {
        store[i] = {
          ...store[i],
          sync_status: status,
          sync_error_message: errorMessage ?? null,
        };
      }
    }
    saveWebStore(store);
    return;
  }

  const db = await getDatabase();
  if (!db) return;

  await db.withTransactionAsync(async () => {
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE farmer_registry SET sync_status = ?, sync_error_message = ? WHERE id IN (${placeholders})`,
      [String(status || 'PENDING_SYNC'), errorMessage ? String(errorMessage) : '', ...ids.map(String)]
    );
  });
}

/**
 * Retrieves summary statistics from the database.
 */
export async function getDatabaseStats(): Promise<DatabaseStats> {
  if (isWebPlatform) {
    const store = getWebStore();
    const pending = store.filter((r) => r.sync_status === 'PENDING_SYNC').length;
    const synced = store.filter((r) => r.sync_status === 'SYNCED').length;
    const error = store.filter((r) => r.sync_status === 'ERROR').length;
    return {
      total: store.length,
      pending,
      synced,
      error,
    };
  }

  const db = await getDatabase();
  if (!db) {
    return { total: 0, pending: 0, synced: 0, error: 0 };
  }

  const totalRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM farmer_registry');
  const pendingRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM farmer_registry WHERE sync_status = 'PENDING_SYNC'"
  );
  const syncedRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM farmer_registry WHERE sync_status = 'SYNCED'"
  );
  const errorRow = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM farmer_registry WHERE sync_status = 'ERROR'"
  );

  return {
    total: totalRow?.count ?? 0,
    pending: pendingRow?.count ?? 0,
    synced: syncedRow?.count ?? 0,
    error: errorRow?.count ?? 0,
  };
}

/**
 * Deletes a single farmer record by ID.
 */
export async function deleteFarmerRecord(id: string): Promise<boolean> {
  if (isWebPlatform) {
    const store = getWebStore();
    const next = store.filter((r) => r.id !== id);
    const changed = next.length !== store.length;
    saveWebStore(next);
    return changed;
  }

  const db = await getDatabase();
  if (!db) return false;
  const result = await db.runAsync('DELETE FROM farmer_registry WHERE id = ?', [String(id || '')]);
  return result.changes > 0;
}

/**
 * Clears all records from the database (used for testing and resets).
 */
export async function clearDatabase(): Promise<void> {
  if (isWebPlatform) {
    saveWebStore([]);
    return;
  }

  const db = await getDatabase();
  if (!db) return;
  await db.execAsync('DELETE FROM farmer_registry;');
}
