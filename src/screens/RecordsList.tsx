import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { getAllFarmers, deleteFarmerRecord, clearDatabase } from '../db/database';
import { FarmerRecord, SyncStatus } from '../types';

export default function RecordsList() {
  const [records, setRecords] = useState<FarmerRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<FarmerRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SyncStatus>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<FarmerRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await getAllFarmers(200);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load SQLite records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    let result = records;

    if (statusFilter !== 'ALL') {
      result = result.filter((r) => r.sync_status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.farmer_name.toLowerCase().includes(query) ||
          r.nin.includes(query) ||
          r.bvn.includes(query) ||
          r.crop_type.toLowerCase().includes(query) ||
          r.lga.toLowerCase().includes(query)
      );
    }

    setFilteredRecords(result);
  }, [records, searchQuery, statusFilter]);

  const handleDeleteRecord = async (id: string) => {
    Alert.alert('Delete Record', 'Are you sure you want to delete this record from local SQLite database?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFarmerRecord(id);
          setSelectedRecord(null);
          await loadRecords();
        },
      },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear SQLite Database', 'This will delete ALL local farmer records. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearDatabase();
          await loadRecords();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Search & Filter Header */}
      <View style={styles.headerBox}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="🔍 Search name, NIN, BVN, LGA..."
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity style={styles.refreshButton} onPress={loadRecords}>
            <Text style={styles.refreshButtonText}>↺</Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Chips */}
        <View style={styles.filterRow}>
          {(['ALL', 'PENDING_SYNC', 'SYNCED', 'ERROR'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                statusFilter === filter ? styles.filterChipActive : null,
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === filter ? styles.filterChipTextActive : null,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.clearDbButton} onPress={handleClearAll}>
            <Text style={styles.clearDbButtonText}>Clear DB</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Records Count Bar */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          Showing {filteredRecords.length} of {records.length} stored record(s)
        </Text>
      </View>

      {/* List Content */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySubtitle}>
              {records.length === 0
                ? 'Use the Capture Form tab to register and save farmer data offline.'
                : 'Try adjusting your search query or status filter.'}
            </Text>
          </View>
        ) : (
          filteredRecords.map((record) => (
            <TouchableOpacity
              key={record.id}
              style={styles.recordCard}
              onPress={() => setSelectedRecord(record)}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.farmerName}>{record.farmer_name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    record.sync_status === 'SYNCED'
                      ? styles.badgeSynced
                      : record.sync_status === 'ERROR'
                      ? styles.badgeError
                      : styles.badgePending,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>{record.sync_status}</Text>
                </View>
              </View>

              <View style={styles.detailsGrid}>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>NIN: </Text>
                  <Text style={styles.detailValueBold}>{record.nin}</Text>
                </Text>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>BVN: </Text>
                  <Text style={styles.detailValueBold}>{record.bvn}</Text>
                </Text>
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Crop: </Text>
                  <Text style={styles.detailValue}>{record.crop_type} ({record.farm_size_hectares} ha)</Text>
                </Text>
                {record.farm_location ? (
                  <Text style={styles.detailItem} numberOfLines={1}>
                    <Text style={styles.detailLabel}>Farm: </Text>
                    <Text style={styles.detailValue}>{record.farm_location}</Text>
                  </Text>
                ) : null}
                <Text style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Admin: </Text>
                  <Text style={styles.detailValue}>{record.lga}, {record.community_ward}</Text>
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.capturedAtText}>
                  Captured: {new Date(record.captured_at).toLocaleString()}
                </Text>
                <Text style={styles.viewDetailsPrompt}>Inspect ➔</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Record Inspector Modal */}
      <Modal visible={selectedRecord !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedRecord && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedRecord.farmer_name}</Text>
                  <TouchableOpacity onPress={() => setSelectedRecord(null)}>
                    <Text style={styles.modalCloseText}>✕ Close</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.inspectorSection}>
                    <Text style={styles.sectionHeader}>18-Column Database Inspector</Text>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Record ID (UUID v4):</Text>
                      <Text style={styles.inspectorCode}>{selectedRecord.id}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Agent ID / Device:</Text>
                      <Text style={styles.inspectorVal}>{selectedRecord.agent_id} | {selectedRecord.device_uuid}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>NIN (Strict 11-digit string):</Text>
                      <Text style={styles.inspectorValHighlight}>{selectedRecord.nin}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>BVN (Strict 11-digit string):</Text>
                      <Text style={styles.inspectorValHighlight}>{selectedRecord.bvn}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Phone Number:</Text>
                      <Text style={styles.inspectorVal}>{selectedRecord.phone_number}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>LGA / Community:</Text>
                      <Text style={styles.inspectorVal}>{selectedRecord.lga} / {selectedRecord.community_ward}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Cooperative:</Text>
                      <Text style={styles.inspectorVal}>{selectedRecord.cooperative_name}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Crop / Farm Size / Yield:</Text>
                      <Text style={styles.inspectorVal}>
                        {selectedRecord.crop_type} | {selectedRecord.farm_size_hectares} ha | {selectedRecord.estimated_yield_tonnes} tonnes
                      </Text>
                    </View>

                    {selectedRecord.farm_location ? (
                      <View style={styles.inspectorRow}>
                        <Text style={styles.inspectorLabel}>Physical Farm Location / Landmark:</Text>
                        <Text style={styles.inspectorVal}>{selectedRecord.farm_location}</Text>
                      </View>
                    ) : null}

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>GPS Coordinates:</Text>
                      <Text style={styles.inspectorVal}>
                        Lat: {selectedRecord.latitude}°, Lng: {selectedRecord.longitude}°
                      </Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Biometric Template Hash (SHA-256):</Text>
                      <Text style={styles.inspectorCode}>{selectedRecord.biometric_template_hash}</Text>
                    </View>

                    <View style={styles.inspectorRow}>
                      <Text style={styles.inspectorLabel}>Sync Status & Timestamp:</Text>
                      <Text style={styles.inspectorVal}>
                        {selectedRecord.sync_status} at {selectedRecord.captured_at}
                      </Text>
                    </View>

                    {selectedRecord.sync_error_message && (
                      <View style={styles.inspectorRow}>
                        <Text style={[styles.inspectorLabel, { color: '#DC2626' }]}>Sync Error:</Text>
                        <Text style={{ color: '#DC2626', fontSize: 12 }}>{selectedRecord.sync_error_message}</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteRecord(selectedRecord.id)}
                  >
                    <Text style={styles.deleteButtonText}>🗑 Delete Record From SQLite</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  headerBox: {
    padding: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 2,
    borderBottomColor: '#334155',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#475569',
    fontSize: 14,
  },
  refreshButton: {
    width: 46,
    height: 46,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  clearDbButton: {
    marginLeft: 'auto',
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clearDbButtonText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  countBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  countText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#000000',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  farmerName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    flex: 1,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  badgeSynced: {
    backgroundColor: '#D1FAE5',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeError: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailsGrid: {
    marginBottom: 8,
  },
  detailItem: {
    fontSize: 13,
    marginBottom: 3,
    color: '#334155',
    flexWrap: 'wrap',
  },
  detailLabel: {
    color: '#64748B',
    fontWeight: '600',
  },
  detailValueBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  detailValue: {
    fontWeight: '600',
    color: '#1E293B',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  capturedAtText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    flexShrink: 1,
  },
  viewDetailsPrompt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 12,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#0F172A',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    flex: 1,
    flexShrink: 1,
  },
  modalCloseText: {
    color: '#94A3B8',
    fontWeight: '800',
    fontSize: 13,
  },
  modalBody: {
    padding: 16,
  },
  inspectorSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inspectorRow: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inspectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  inspectorVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inspectorValHighlight: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E40AF',
  },
  inspectorCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#334155',
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 4,
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
