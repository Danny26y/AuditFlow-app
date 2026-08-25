import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { syncEngine, BATCH_SIZE } from '../services/syncEngine';
import { getDatabaseStats, getPendingSyncRecords } from '../db/database';
import { DatabaseStats, FarmerRecord, SyncProgress } from '../types';
import { deviceService, DeviceInfo } from '../services/deviceService';

export interface SyncDashboardProps {
  onNavigateToRecords?: () => void;
}

export default function SyncDashboard({ onNavigateToRecords }: SyncDashboardProps) {
  const [stats, setStats] = useState<DatabaseStats>({ total: 0, pending: 0, synced: 0, error: 0 });
  const [pendingRecords, setPendingRecords] = useState<FarmerRecord[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>(syncEngine.getProgress());
  const [isOnline, setIsOnline] = useState<boolean>(syncEngine.getIsOnline());
  const [isMockBackend, setIsMockBackend] = useState<boolean>(syncEngine.isMockBackend());
  const [backendUrl, setBackendUrl] = useState<string>(syncEngine.getBackendUrl());
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Device & Agent Identity
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [editableAgentId, setEditableAgentId] = useState<string>('');
  const [isEditingAgent, setIsEditingAgent] = useState<boolean>(false);

  // Backend Diagnostic State
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs?: number;
    message: string;
  } | null>(null);

  const loadDashboardData = async () => {
    setIsLoadingData(true);
    try {
      const dbStats = await getDatabaseStats();
      setStats(dbStats);
      const pending = await getPendingSyncRecords(10);
      setPendingRecords(pending);

      const info = await deviceService.getDeviceInfo();
      setDeviceInfo(info);
      setEditableAgentId(info.agentId);
    } catch (err) {
      console.error('Failed to load sync stats:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const unsubscribeSync = syncEngine.addListener((progress) => {
      setSyncProgress(progress);
      setIsOnline(syncEngine.getIsOnline());
      if (!progress.isSyncing) {
        loadDashboardData();
      }
    });

    return () => {
      unsubscribeSync();
    };
  }, []);

  /**
   * Pings the FastAPI backend `/health` endpoint to test physical connectivity
   */
  const handleTestBackendConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus({
          tested: true,
          success: true,
          latencyMs: latency,
          message: `Connected successfully (${latency}ms)! FastAPI backend is active and ready for batch sync.`,
        });
      } else {
        setConnectionStatus({
          tested: true,
          success: false,
          message: `Backend returned HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (err: any) {
      const errorMsg = err?.name === 'AbortError' ? 'Connection timed out after 6 seconds.' : err?.message || String(err);
      setConnectionStatus({
        tested: true,
        success: false,
        message: `Could not reach ${backendUrl}. Ensure FastAPI backend is running with 'python -m uvicorn main:app --host 0.0.0.0 --port 8000' and your phone is on the same network. Error: ${errorMsg}`,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleTriggerSync = async () => {
    try {
      await syncEngine.syncNow();
      await loadDashboardData();
    } catch (err: any) {
      Alert.alert('Sync Trigger Error', err?.message || 'Sync failed.');
    }
  };

  const handleToggleMockBackend = (value: boolean) => {
    setIsMockBackend(value);
    syncEngine.setMockBackend(value);
  };

  const handleSaveBackendUrl = () => {
    syncEngine.setBackendUrl(backendUrl);
    Alert.alert('Backend Updated', `API endpoint set to ${backendUrl}/api/v1/ingest/batch`);
    handleTestBackendConnection();
  };

  const handleSaveAgentId = () => {
    if (!editableAgentId.trim()) {
      Alert.alert('Invalid Agent ID', 'Agent ID cannot be empty.');
      return;
    }
    deviceService.setAgentId(editableAgentId);
    setIsEditingAgent(false);
    loadDashboardData();
    Alert.alert('Agent ID Updated', `Assigned Agent ID updated to ${editableAgentId.trim().toUpperCase()}`);
  };

  const totalBatchesNeeded = Math.ceil((stats.pending + stats.error) / BATCH_SIZE);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header & Network Status */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Batch Sync Center</Text>
          <View
            style={[
              styles.networkBadge,
              isOnline ? styles.networkBadgeOnline : styles.networkBadgeOffline,
            ]}
          >
            <Text style={styles.networkBadgeText}>
              {isOnline ? '● ONLINE' : '○ OFFLINE'}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Chunked offline sync engine — pushing records in batches of {BATCH_SIZE}
        </Text>
      </View>

      {/* Database Queue Metrics */}
      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { borderColor: '#E2E8F0' }]}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total Stored</Text>
        </View>

        <View style={[styles.statBox, { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.statNumber, { color: '#B45309' }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { color: '#92400E' }]}>Pending Sync</Text>
        </View>

        <View style={[styles.statBox, { borderColor: '#10B981', backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.statNumber, { color: '#047857' }]}>{stats.synced}</Text>
          <Text style={[styles.statLabel, { color: '#065F46' }]}>Synced</Text>
        </View>

        <View style={[styles.statBox, { borderColor: '#EF4444', backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statNumber, { color: '#B91C1C' }]}>{stats.error}</Text>
          <Text style={[styles.statLabel, { color: '#991B1B' }]}>Failed/Retry</Text>
        </View>
      </View>

      {/* Terminal & Unique Agent Identity Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Terminal & Agent Identity</Text>
          <Text style={styles.hardwareBadge}>🔒 Hardware Verified</Text>
        </View>

        {deviceInfo && (
          <View style={styles.terminalInfoBox}>
            <View style={styles.terminalRow}>
              <Text style={styles.terminalLabel}>Unique Device UUID:</Text>
              <Text style={styles.terminalValHighlight}>{deviceInfo.deviceUuid}</Text>
            </View>

            <View style={styles.terminalRow}>
              <Text style={styles.terminalLabel}>Assigned Agent ID:</Text>
              {isEditingAgent ? (
                <View style={styles.agentEditRow}>
                  <TextInput
                    style={styles.agentEditInput}
                    value={editableAgentId}
                    onChangeText={setEditableAgentId}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity style={styles.agentSaveBtn} onPress={handleSaveAgentId}>
                    <Text style={styles.agentSaveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.agentDisplayRow}>
                  <Text style={styles.terminalValHighlight}>{deviceInfo.agentId}</Text>
                  <TouchableOpacity onPress={() => setIsEditingAgent(true)} style={styles.agentChangeBtn}>
                    <Text style={styles.agentChangeBtnText}>Edit ID</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.terminalRow}>
              <Text style={styles.terminalLabel}>Hardware Terminal:</Text>
              <Text style={styles.terminalVal}>{deviceInfo.deviceName} ({deviceInfo.osName} {deviceInfo.osVersion})</Text>
            </View>
          </View>
        )}
      </View>

      {/* Sync Execution Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Batch Synchronization</Text>

        <View style={styles.batchInfoBox}>
          <Text style={styles.batchInfoText}>
            • Chunk Size: <Text style={{ fontWeight: '800' }}>{BATCH_SIZE} records / payload</Text>
          </Text>
          <Text style={styles.batchInfoText}>
            • Total Pending Batches: <Text style={{ fontWeight: '800' }}>{totalBatchesNeeded}</Text>
          </Text>
          <Text style={styles.lastSyncedText}>
            Last Synchronized:{' '}
            {syncProgress.lastSyncedAt
              ? new Date(syncProgress.lastSyncedAt).toLocaleString()
              : 'Not yet synchronized'}
          </Text>
        </View>

        {/* Live Progress Bar during active sync */}
        {syncProgress.isSyncing && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>
                Pushing Batch {syncProgress.currentBatch} of {syncProgress.totalBatches}...
              </Text>
              <ActivityIndicator size="small" color="#2563EB" />
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${
                      syncProgress.totalBatches > 0
                        ? (syncProgress.currentBatch / syncProgress.totalBatches) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressSubtext}>
              {syncProgress.syncedCount} of {syncProgress.totalRecordsToSync} records successfully pushed
            </Text>
          </View>
        )}

        {syncProgress.lastError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxTitle}>⚠️ Last Batch Ingestion Error</Text>
            <Text style={styles.errorBoxText}>{syncProgress.lastError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.syncNowButton,
            syncProgress.isSyncing ? styles.syncNowButtonDisabled : null,
          ]}
          onPress={handleTriggerSync}
          disabled={syncProgress.isSyncing}
        >
          {syncProgress.isSyncing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.syncNowButtonText}>
              🚀 Sync {stats.pending + stats.error} Pending Record(s) Now
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Backend Connectivity & Diagnostics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend Connectivity & Health Check</Text>

        <View style={styles.configRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.configLabel}>Mock Backend Simulation</Text>
            <Text style={styles.configDescription}>
              Simulates FastAPI `POST /api/v1/ingest/batch` locally without network calls
            </Text>
          </View>
          <Switch
            value={isMockBackend}
            onValueChange={handleToggleMockBackend}
            trackColor={{ false: '#94A3B8', true: '#2563EB' }}
          />
        </View>

        {!isMockBackend && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.configLabel}>FastAPI Base URL</Text>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                value={backendUrl}
                onChangeText={setBackendUrl}
                placeholder="http://10.0.2.2:8000 or http://192.168.1.100:8000"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.saveUrlButton} onPress={handleSaveBackendUrl}>
                <Text style={styles.saveUrlButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Test Connection Button */}
            <TouchableOpacity
              style={[styles.testConnectionButton, isTestingConnection ? styles.testConnectionButtonDisabled : null]}
              onPress={handleTestBackendConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.testConnectionButtonText}>📡 Test Backend Connection (Ping)</Text>
              )}
            </TouchableOpacity>

            {/* Connection Test Diagnostics Result */}
            {connectionStatus && (
              <View
                style={[
                  styles.diagnosticBox,
                  connectionStatus.success ? styles.diagnosticSuccess : styles.diagnosticError,
                ]}
              >
                <Text
                  style={[
                    styles.diagnosticTitle,
                    connectionStatus.success ? styles.diagnosticSuccessTitle : styles.diagnosticErrorTitle,
                  ]}
                >
                  {connectionStatus.success ? '✓ Connected to FastAPI Backend' : '✕ Connection Error'}
                </Text>
                <Text
                  style={[
                    styles.diagnosticText,
                    connectionStatus.success ? styles.diagnosticSuccessText : styles.diagnosticErrorText,
                  ]}
                >
                  {connectionStatus.message}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Pending Queue Preview */}
      <View style={styles.card}>
        <View style={styles.queueHeaderRow}>
          <Text style={styles.cardTitle}>Next Batch Preview (Up to 10)</Text>
          {onNavigateToRecords && (
            <TouchableOpacity onPress={onNavigateToRecords}>
              <Text style={styles.viewAllText}>View All DB ➔</Text>
            </TouchableOpacity>
          )}
        </View>

        {pendingRecords.length === 0 ? (
          <Text style={styles.emptyQueueText}>All records are fully synchronized! ✓</Text>
        ) : (
          pendingRecords.map((rec, idx) => (
            <View key={rec.id} style={styles.queueItem}>
              <View style={styles.queueItemLeft}>
                <Text style={styles.queueItemIndex}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueItemName}>{rec.farmer_name}</Text>
                  <Text style={styles.queueItemSub}>
                    NIN: {rec.nin} • {rec.crop_type} ({rec.farm_size_hectares} ha)
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.itemStatusBadge,
                  rec.sync_status === 'ERROR' ? styles.itemStatusError : styles.itemStatusPending,
                ]}
              >
                <Text style={styles.itemStatusBadgeText}>{rec.sync_status}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 14,
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  networkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  networkBadgeOnline: {
    backgroundColor: '#065F46',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  networkBadgeOffline: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  networkBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
  },
  hardwareBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  terminalInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  terminalRow: {
    marginBottom: 6,
  },
  terminalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  terminalValHighlight: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E40AF',
    marginTop: 1,
  },
  terminalVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  agentDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agentChangeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
  },
  agentChangeBtnText: {
    color: '#1E40AF',
    fontSize: 10,
    fontWeight: '800',
  },
  agentEditRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  agentEditInput: {
    flex: 1,
    height: 36,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: '#FFFFFF',
  },
  agentSaveBtn: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  batchInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  batchInfoText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 3,
  },
  lastSyncedText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  progressContainer: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E40AF',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  progressSubtext: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  errorBoxText: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 2,
  },
  syncNowButton: {
    minHeight: 50,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  syncNowButtonDisabled: {
    backgroundColor: '#94A3B8',
    borderColor: '#64748B',
  },
  syncNowButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  configDescription: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  urlInputRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 6,
  },
  urlInput: {
    flex: 1,
    height: 42,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 12,
    backgroundColor: '#FFFFFF',
  },
  saveUrlButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
  },
  saveUrlButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  testConnectionButton: {
    marginTop: 8,
    minHeight: 42,
    backgroundColor: '#0F766E',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#115E59',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  testConnectionButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  testConnectionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  diagnosticBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  diagnosticSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  diagnosticError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  diagnosticTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  diagnosticSuccessTitle: {
    color: '#065F46',
  },
  diagnosticErrorTitle: {
    color: '#991B1B',
  },
  diagnosticText: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  diagnosticSuccessText: {
    color: '#047857',
    fontWeight: '600',
  },
  diagnosticErrorText: {
    color: '#B91C1C',
    fontWeight: '500',
  },
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  emptyQueueText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
  },
  queueItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 6,
  },
  queueItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  queueItemIndex: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    width: 24,
  },
  queueItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  queueItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  itemStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemStatusPending: {
    backgroundColor: '#FEF3C7',
  },
  itemStatusError: {
    backgroundColor: '#FEE2E2',
  },
  itemStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
});
