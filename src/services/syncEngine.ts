import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import uuid from 'react-native-uuid';
import {
  FarmerRecord,
  SyncBatchPayload,
  SyncBatchResponse,
  SyncProgress,
  SyncStatus,
} from '../types';
import {
  getPendingSyncRecords,
  updateBatchSyncStatus,
  updateSyncStatus,
  getDatabaseStats,
} from '../db/database';

export const BATCH_SIZE = 10;
export const DEFAULT_BACKEND_URL = 'https://auditflow-app.fastapicloud.dev'; // Live FastAPI Cloud production server

type SyncProgressCallback = (progress: SyncProgress) => void;

class SyncEngine {
  private backendBaseUrl: string = DEFAULT_BACKEND_URL;
  private isSyncing: boolean = false;
  private netInfoUnsubscribe: NetInfoSubscription | null = null;
  private isAutoSyncEnabled: boolean = true;
  private isOnline: boolean = false;
  private listeners: Set<SyncProgressCallback> = new Set();
  private mockBackendMode: boolean = false; // Connect to live FastAPI backend by default

  private progress: SyncProgress = {
    isSyncing: false,
    totalBatches: 0,
    currentBatch: 0,
    recordsInBatch: 0,
    totalRecordsToSync: 0,
    syncedCount: 0,
    errorCount: 0,
    lastError: null,
    lastSyncedAt: null,
  };

  constructor() {
    this.initNetworkListener();
  }

  public setBackendUrl(url: string): void {
    this.backendBaseUrl = url.replace(/\/$/, '');
  }

  public getBackendUrl(): string {
    return this.backendBaseUrl;
  }

  public setMockBackend(enabled: boolean): void {
    this.mockBackendMode = enabled;
  }

  public isMockBackend(): boolean {
    return this.mockBackendMode;
  }

  public getProgress(): SyncProgress {
    return { ...this.progress };
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public addListener(callback: SyncProgressCallback): () => void {
    this.listeners.add(callback);
    callback(this.getProgress());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.getProgress());
      } catch (err) {
        console.error('Error in sync engine progress listener:', err);
      }
    }
  }

  /**
   * Initializes network listener to detect connectivity changes
   * and auto-trigger sync when back online.
   */
  public initNetworkListener(): void {
    if (this.netInfoUnsubscribe) return;

    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);

      // Auto-trigger sync on transition from offline to online
      if (wasOffline && this.isOnline && this.isAutoSyncEnabled && !this.isSyncing) {
        console.log('[SyncEngine] Network connection established. Triggering auto batch sync...');
        this.syncNow().catch((err) => {
          console.warn('[SyncEngine] Auto-sync failed:', err);
        });
      }
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      this.isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    });
  }

  public setAutoSyncEnabled(enabled: boolean): void {
    this.isAutoSyncEnabled = enabled;
  }

  /**
   * Chunks an array of items into slices of size N.
   */
  private chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Pushes a single batch chunk (up to 10 records) to the backend API.
   */
  private async pushBatch(chunk: FarmerRecord[]): Promise<SyncBatchResponse> {
    const batchId = uuid.v4().toString();
    const agentId = chunk[0]?.agent_id || 'AGENT_DEFAULT';
    const timestamp = new Date().toISOString();

    const payload: SyncBatchPayload = {
      batch_id: batchId,
      agent_id: agentId,
      timestamp,
      batch_size: chunk.length,
      records: chunk,
    };

    // If Mock Backend Mode is enabled (or fallback when test server unreachable)
    if (this.mockBackendMode) {
      // Simulate network request latency (600ms per batch)
      await new Promise((res) => setTimeout(res, 600));

      return {
        batch_id: batchId,
        status: 'SUCCESS',
        processed_count: chunk.length,
        success_count: chunk.length,
        error_count: 0,
        message: `Successfully ingested batch ${batchId} (${chunk.length} records).`,
      };
    }

    // Physical HTTP POST request to FastAPI backend (ingest.py)
    const endpoint = `${this.backendBaseUrl}/api/v1/ingest/batch`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const data: SyncBatchResponse = await response.json();
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Executes chunked batch synchronization for all pending records in SQLite.
   * Splits records into chunks of 10, dispatches batches, and transactional updates database status.
   */
  public async syncNow(): Promise<SyncProgress> {
    if (this.isSyncing) {
      console.log('[SyncEngine] Synchronization is already in progress.');
      return this.getProgress();
    }

    this.isSyncing = true;

    try {
      const pendingRecords = await getPendingSyncRecords();

      if (pendingRecords.length === 0) {
        console.log('[SyncEngine] No pending records to sync.');
        this.progress = {
          ...this.progress,
          isSyncing: false,
          totalBatches: 0,
          currentBatch: 0,
          recordsInBatch: 0,
          totalRecordsToSync: 0,
          lastError: null,
        };
        this.notifyListeners();
        this.isSyncing = false;
        return this.getProgress();
      }

      // Chunk records strictly into batches of 10
      const batches = this.chunkArray(pendingRecords, BATCH_SIZE);
      const totalRecords = pendingRecords.length;

      this.progress = {
        isSyncing: true,
        totalBatches: batches.length,
        currentBatch: 0,
        recordsInBatch: 0,
        totalRecordsToSync: totalRecords,
        syncedCount: 0,
        errorCount: 0,
        lastError: null,
        lastSyncedAt: this.progress.lastSyncedAt,
      };
      this.notifyListeners();

      let overallSynced = 0;
      let overallErrors = 0;

      for (let i = 0; i < batches.length; i++) {
        const currentBatchChunk = batches[i];
        const batchIds = currentBatchChunk.map((r) => r.id);

        this.progress.currentBatch = i + 1;
        this.progress.recordsInBatch = currentBatchChunk.length;
        this.notifyListeners();

        try {
          const result = await this.pushBatch(currentBatchChunk);

          if (result.status === 'SUCCESS') {
            const successfulIds = result.synced_ids && result.synced_ids.length > 0 ? result.synced_ids : batchIds;
            await updateBatchSyncStatus(successfulIds, 'SYNCED', null);
            overallSynced += successfulIds.length;
          } else if (result.results && result.results.length > 0) {
            // Handle itemized responses for partial or error batches
            for (const item of result.results) {
              if (item.status === 'SUCCESS') {
                await updateSyncStatus(item.id, 'SYNCED', null);
                overallSynced++;
              } else {
                await updateSyncStatus(item.id, 'ERROR', item.error_message || 'Server rejected record');
                overallErrors++;
              }
            }
          } else if (result.synced_ids && result.synced_ids.length > 0) {
            await updateBatchSyncStatus(result.synced_ids, 'SYNCED', null);
            overallSynced += result.synced_ids.length;
            const failedIds = batchIds.filter((id) => !result.synced_ids!.includes(id));
            if (failedIds.length > 0) {
              await updateBatchSyncStatus(failedIds, 'ERROR', result.message || 'Rejected during batch ingestion');
              overallErrors += failedIds.length;
            }
          } else {
            throw new Error(result.message || 'Batch ingestion failed');
          }
        } catch (batchErr: any) {
          const errorMsg = batchErr?.message || String(batchErr);
          console.error(`[SyncEngine] Error syncing batch ${i + 1}:`, errorMsg);
          overallErrors += currentBatchChunk.length;
          this.progress.lastError = errorMsg;

          // Update records to ERROR status so they can be retried
          await updateBatchSyncStatus(batchIds, 'ERROR', errorMsg);
        }

        this.progress.syncedCount = overallSynced;
        this.progress.errorCount = overallErrors;
        this.notifyListeners();
      }

      this.progress.isSyncing = false;
      this.progress.lastSyncedAt = new Date().toISOString();
      this.notifyListeners();
    } catch (err: any) {
      console.error('[SyncEngine] Fatal error during sync:', err);
      this.progress.isSyncing = false;
      this.progress.lastError = err?.message || String(err);
      this.notifyListeners();
    } finally {
      this.isSyncing = false;
    }

    return this.getProgress();
  }

  public destroy(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
  }
}

export const syncEngine = new SyncEngine();
