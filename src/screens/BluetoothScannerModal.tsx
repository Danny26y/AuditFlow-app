import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { bluetoothService, ESP32_SERVICE_UUID_UPPER } from '../services/bluetooth';
import { BluetoothConnectionState, BluetoothDevice, BiometricScanResult } from '../types';

export default function BluetoothScannerModal() {
  const [connectionState, setConnectionState] = useState<BluetoothConnectionState>(
    bluetoothService.getConnectionState()
  );
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(
    bluetoothService.getConnectedDevice()
  );
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isScanningDevices, setIsScanningDevices] = useState<boolean>(false);
  const [isTestingScan, setIsTestingScan] = useState<boolean>(false);
  const [scanStatusMessage, setScanStatusMessage] = useState<string>('');
  const [lastScanResult, setLastScanResult] = useState<BiometricScanResult | null>(null);

  useEffect(() => {
    const unsubscribe = bluetoothService.addListener((state, data) => {
      setConnectionState(state);
      if (data?.device !== undefined) setConnectedDevice(data.device);
      if (data?.discovered) setDiscoveredDevices(data.discovered);
      if (data?.scanResult) setLastScanResult(data.scanResult);
      if (data?.prompt) setScanStatusMessage(data.prompt);
      else if (data?.status) setScanStatusMessage(data.status);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleScanForDevices = async () => {
    setIsScanningDevices(true);
    setDiscoveredDevices([]);
    try {
      const devices = await bluetoothService.scanForDevices();
      setDiscoveredDevices(devices);
      if (devices.length === 0) {
        Alert.alert(
          'No Scanners Found',
          'Ensure your ESP32 fingerprint scanner is powered on (blue LED standby) and nearby.'
        );
      }
    } catch (err: any) {
      Alert.alert('Scan Failed', err?.message || 'Could not scan for Bluetooth devices.');
    } finally {
      setIsScanningDevices(false);
    }
  };

  const handleConnectDevice = async (device: BluetoothDevice) => {
    try {
      const success = await bluetoothService.connect(device.id);
      if (success) {
        setConnectedDevice(device);
        Alert.alert('Connected', `Paired successfully with ${device.name}`);
      }
    } catch (err: any) {
      Alert.alert('Pairing Error', err?.message || 'Could not connect to device.');
    }
  };

  const handleDisconnect = async () => {
    await bluetoothService.disconnect();
    setConnectedDevice(null);
    setLastScanResult(null);
    setScanStatusMessage('');
  };

  const handleTestFingerprintScan = async () => {
    if (connectionState !== 'CONNECTED') {
      Alert.alert('Scanner Not Paired', 'Please scan for and connect your ESP32 scanner first.');
      return;
    }

    setIsTestingScan(true);
    setScanStatusMessage('Please place finger on ESP32 optical sensor...');
    try {
      const res = await bluetoothService.triggerBiometricScan();
      setLastScanResult(res);
      setScanStatusMessage('Fingerprint template extracted successfully!');
    } catch (err: any) {
      Alert.alert('Biometric Scan Error', err?.message || 'Scan failed.');
      setScanStatusMessage('');
    } finally {
      setIsTestingScan(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>ESP32 Biometric Scanner</Text>
          <View
            style={[
              styles.stateBadge,
              connectionState === 'CONNECTED'
                ? styles.stateBadgeConnected
                : connectionState === 'SCANNING_FINGER'
                ? styles.stateBadgeScanning
                : styles.stateBadgeDisconnected,
            ]}
          >
            <Text style={styles.stateBadgeText}>{connectionState}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Physical BLE hardware pairing & JM101B fingerprint template extraction engine
        </Text>
      </View>

      {/* Hardware Spec Info Card */}
      <View style={styles.specCard}>
        <Text style={styles.specTitle}>Hardware Configuration</Text>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Service UUID:</Text>
          <Text style={styles.specValue}>{ESP32_SERVICE_UUID_UPPER}</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Device Fleet Prefix:</Text>
          <Text style={styles.specValue}>AuditFlow_Scanner_XXXX</Text>
        </View>
        <View style={styles.specRow}>
          <Text style={styles.specLabel}>Protocol:</Text>
          <Text style={styles.specValue}>GATT SOF ➔ 512B Chunks ➔ EOF (SHA-256)</Text>
        </View>
      </View>

      {/* Active Connection Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Paired Scanner Status</Text>

        {connectedDevice ? (
          <View style={styles.connectedBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.deviceName}>{connectedDevice.name}</Text>
              <Text style={styles.deviceId}>ID: {connectedDevice.id}</Text>
              <Text style={styles.rssiText}>Signal: {connectedDevice.rssi ?? -60} dBm (Active)</Text>
            </View>
            <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noDeviceBox}>
            <Text style={styles.noDeviceText}>
              No physical ESP32 scanner currently paired. Tap below to scan nearby Bluetooth LE devices.
            </Text>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={handleScanForDevices}
              disabled={isScanningDevices}
            >
              {isScanningDevices ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.scanBtnText}>  Scanning for ESP32 Scanners...</Text>
                </View>
              ) : (
                <Text style={styles.scanBtnText}>🔍 Scan for Nearby Scanners</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Discovered Devices List */}
        {discoveredDevices.length > 0 && !connectedDevice && (
          <View style={styles.deviceListContainer}>
            <Text style={styles.deviceListHeader}>Discovered ESP32 Units ({discoveredDevices.length}):</Text>
            {discoveredDevices.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={styles.deviceRow}
                onPress={() => handleConnectDevice(d)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceRowName}>{d.name}</Text>
                  <Text style={styles.deviceRowId}>
                    MAC/ID: {d.id} • Signal: {d.rssi} dBm
                  </Text>
                </View>
                <View style={styles.pairButton}>
                  <Text style={styles.pairButtonText}>Pair ➔</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Test Fingerprint Capture */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test Biometric Acquisition</Text>
        <Text style={styles.cardSubtext}>
          Arms the JM101B sensor. When the farmer touches the optical glass, the ESP32 streams the 512-byte template.
        </Text>

        <TouchableOpacity
          style={[
            styles.testScanBtn,
            connectionState === 'SCANNING_FINGER' ? styles.testScanBtnActive : null,
            !connectedDevice ? styles.testScanBtnDisabled : null,
          ]}
          onPress={handleTestFingerprintScan}
          disabled={isTestingScan || !connectedDevice}
        >
          {isTestingScan ? (
            <View style={styles.btnLoadingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.testScanBtnText}>  Waiting for Finger Touch...</Text>
            </View>
          ) : (
            <Text style={styles.testScanBtnText}>
              {connectedDevice ? '👆 Trigger Biometric Sensor Scan' : 'Pair Scanner to Test Acquisition'}
            </Text>
          )}
        </TouchableOpacity>

        {scanStatusMessage ? (
          <View style={styles.statusMessageBox}>
            <Text style={styles.statusMessageText}>{scanStatusMessage}</Text>
          </View>
        ) : null}

        {lastScanResult && (
          <View style={styles.scanResultBox}>
            <View style={styles.scanResultHeader}>
              <Text style={styles.scanResultTitle}>✓ Hardware Template Extracted</Text>
              <Text style={styles.qualityTag}>Score: {lastScanResult.qualityScore}%</Text>
            </View>
            <Text style={styles.templateCodeLabel}>SHA-256 Biometric Hash:</Text>
            <Text style={styles.templateCode}>{lastScanResult.templateHash}</Text>
            <Text style={styles.rawPreviewText}>{lastScanResult.rawBytesPreview}</Text>
            <Text style={styles.timestampText}>Captured At: {lastScanResult.timestamp}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stateBadgeConnected: {
    backgroundColor: '#065F46',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  stateBadgeScanning: {
    backgroundColor: '#92400E',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  stateBadgeDisconnected: {
    backgroundColor: '#334155',
  },
  stateBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '500',
  },
  specCard: {
    backgroundColor: '#0B1329',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  specTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#38BDF8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  specLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  specValue: {
    fontSize: 11,
    color: '#F1F5F9',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#000000',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  connectedBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    marginTop: 8,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#14532D',
  },
  deviceId: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  rssiText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
  },
  disconnectBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  disconnectBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  noDeviceBox: {
    marginTop: 8,
  },
  noDeviceText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 18,
  },
  scanBtn: {
    height: 48,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  deviceListContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  deviceListHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  deviceRowName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceRowId: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  pairButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  pairButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  testScanBtn: {
    height: 50,
    backgroundColor: '#0F766E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  testScanBtnActive: {
    backgroundColor: '#D97706',
  },
  testScanBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  testScanBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  statusMessageBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusMessageText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '700',
    textAlign: 'center',
  },
  scanResultBox: {
    marginTop: 14,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#0D9488',
    borderRadius: 8,
    padding: 12,
  },
  scanResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  scanResultTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F766E',
  },
  qualityTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  templateCodeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  templateCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: '#134E4A',
    backgroundColor: '#E6FFFA',
    padding: 6,
    borderRadius: 4,
    marginTop: 2,
  },
  rawPreviewText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timestampText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});
