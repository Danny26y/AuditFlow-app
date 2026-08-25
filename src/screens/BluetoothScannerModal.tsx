import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { bluetoothService } from '../services/bluetooth';
import { BluetoothConnectionState, BluetoothDevice, BiometricScanResult } from '../types';

export default function BluetoothScannerModal() {
  const [connectionState, setConnectionState] = useState<BluetoothConnectionState>(
    bluetoothService.getConnectionState()
  );
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(
    bluetoothService.getConnectedDevice()
  );
  const [isMock, setIsMock] = useState<boolean>(bluetoothService.isMockMode());
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDevice[]>([]);
  const [isScanningDevices, setIsScanningDevices] = useState<boolean>(false);
  const [isTestingScan, setIsTestingScan] = useState<boolean>(false);
  const [lastScanResult, setLastScanResult] = useState<BiometricScanResult | null>(null);

  useEffect(() => {
    const unsubscribe = bluetoothService.addListener((state, data) => {
      setConnectionState(state);
      if (data?.device !== undefined) setConnectedDevice(data.device);
      if (data?.isMock !== undefined) setIsMock(data.isMock);
      if (data?.scanResult) setLastScanResult(data.scanResult);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleMock = (val: boolean) => {
    setIsMock(val);
    bluetoothService.setMockMode(val);
  };

  const handleScanForDevices = async () => {
    setIsScanningDevices(true);
    try {
      const devices = await bluetoothService.scanForDevices();
      setDiscoveredDevices(devices);
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
        Alert.alert('Connected', `Paired with ${device.name}`);
      }
    } catch (err: any) {
      Alert.alert('Pairing Error', err?.message || 'Could not connect to device.');
    }
  };

  const handleDisconnect = async () => {
    await bluetoothService.disconnect();
    setConnectedDevice(null);
    setLastScanResult(null);
  };

  const handleTestFingerprintScan = async () => {
    setIsTestingScan(true);
    try {
      const res = await bluetoothService.triggerBiometricScan();
      setLastScanResult(res);
    } catch (err: any) {
      Alert.alert('Biometric Scan Error', err?.message || 'Scan failed.');
    } finally {
      setIsTestingScan(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>ESP32 Bluetooth Scanner</Text>
          <View
            style={[
              styles.stateBadge,
              connectionState === 'CONNECTED'
                ? styles.stateBadgeConnected
                : styles.stateBadgeDisconnected,
            ]}
          >
            <Text style={styles.stateBadgeText}>{connectionState}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>
          Fingerprint sensor pairing & biometric template extraction engine
        </Text>
      </View>

      {/* Hardware Simulation Mode Toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Hardware Simulation (Mock Mode)</Text>
            <Text style={styles.cardSubtext}>
              Generates simulated 64-char SHA-256 fingerprint templates with realistic optical sensor delays
            </Text>
          </View>
          <Switch
            value={isMock}
            onValueChange={handleToggleMock}
            trackColor={{ false: '#94A3B8', true: '#10B981' }}
          />
        </View>
      </View>

      {/* Active Connection Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Paired Scanner</Text>

        {connectedDevice ? (
          <View style={styles.connectedBox}>
            <View>
              <Text style={styles.deviceName}>{connectedDevice.name}</Text>
              <Text style={styles.deviceId}>ID: {connectedDevice.id} | RSSI: {connectedDevice.rssi ?? -60} dBm</Text>
            </View>
            <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noDeviceBox}>
            <Text style={styles.noDeviceText}>No ESP32 scanner currently paired.</Text>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={handleScanForDevices}
              disabled={isScanningDevices}
            >
              {isScanningDevices ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.scanBtnText}>🔍 Scan for Nearby Scanners</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Discovered Devices List */}
        {discoveredDevices.length > 0 && !connectedDevice && (
          <View style={styles.deviceListContainer}>
            <Text style={styles.deviceListHeader}>Discovered Devices:</Text>
            {discoveredDevices.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={styles.deviceRow}
                onPress={() => handleConnectDevice(d)}
              >
                <View>
                  <Text style={styles.deviceRowName}>{d.name}</Text>
                  <Text style={styles.deviceRowId}>{d.id} (Signal: {d.rssi} dBm)</Text>
                </View>
                <Text style={styles.connectLink}>Pair ➔</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Test Fingerprint Capture */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Test Biometric Acquisition</Text>

        <TouchableOpacity
          style={[styles.testScanBtn, isTestingScan ? styles.testScanBtnActive : null]}
          onPress={handleTestFingerprintScan}
          disabled={isTestingScan}
        >
          {isTestingScan ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.testScanBtnText}>👆 Trigger Biometric Sensor Scan</Text>
          )}
        </TouchableOpacity>

        {lastScanResult && (
          <View style={styles.scanResultBox}>
            <View style={styles.scanResultHeader}>
              <Text style={styles.scanResultTitle}>Template Successfully Extracted</Text>
              <Text style={styles.qualityTag}>Score: {lastScanResult.qualityScore}%</Text>
            </View>
            <Text style={styles.templateCodeLabel}>SHA-256 Biometric Hash:</Text>
            <Text style={styles.templateCode}>{lastScanResult.templateHash}</Text>
            <Text style={styles.rawPreviewText}>{lastScanResult.rawBytesPreview}</Text>
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
    marginBottom: 16,
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
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  disconnectBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  disconnectBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  noDeviceBox: {
    marginTop: 8,
  },
  noDeviceText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  scanBtn: {
    height: 46,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  deviceRowName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  deviceRowId: {
    fontSize: 11,
    color: '#64748B',
  },
  connectLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  testScanBtn: {
    height: 50,
    backgroundColor: '#0F766E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  testScanBtnActive: {
    backgroundColor: '#D97706',
  },
  testScanBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  scanResultBox: {
    marginTop: 12,
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
    fontSize: 12,
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
});
