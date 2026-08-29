import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription, State as BleState } from 'react-native-ble-plx';
import {
  BiometricScanResult,
  BluetoothConnectionState,
  BluetoothDevice,
} from '../types';
import {
  base64ToBytes,
  bytesToString,
  sha256Binary,
  calculateTemplateQuality,
} from '../utils/crypto';

export const ESP32_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const ESP32_SERVICE_UUID_UPPER = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const ESP32_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
export const ESP32_TX_CHARACTERISTIC_UUID_UPPER = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';

type EventCallback = (state: BluetoothConnectionState, data?: any) => void;

class BluetoothService {
  private bleManager: BleManager | null = null;
  private connectionState: BluetoothConnectionState = 'DISCONNECTED';
  private connectedDevice: BluetoothDevice | null = null;
  private activeDeviceInstance: Device | null = null;
  private charSubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private listeners: Set<EventCallback> = new Set();
  private discoveredDevicesMap: Map<string, BluetoothDevice> = new Map();

  // Biometric chunk reassembly buffer
  private isCapturingTemplate: boolean = false;
  private templateByteChunks: Uint8Array[] = [];
  private totalBytesBuffered: number = 0;
  private pendingScanResolve: ((result: BiometricScanResult) => void) | null = null;
  private pendingScanReject: ((reason: any) => void) | null = null;
  private scanTimeoutTimer: any = null;

  constructor() {
    this.initBleManager();
  }

  private initBleManager() {
    if (Platform.OS === 'web') {
      console.warn('Physical BLE is not supported in web browser mode.');
      return;
    }

    try {
      this.bleManager = new BleManager();
    } catch (err) {
      console.error('Failed to initialize native BleManager:', err);
    }
  }

  /**
   * Requests necessary Bluetooth and Location permissions on Android
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        return (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      }
    } catch (err) {
      console.error('Error requesting Bluetooth permissions:', err);
      return false;
    }
  }

  public getConnectionState(): BluetoothConnectionState {
    return this.connectionState;
  }

  public getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }

  /**
   * Subscribe to Bluetooth and Scanner state changes.
   */
  public addListener(callback: EventCallback): () => void {
    this.listeners.add(callback);
    callback(this.connectionState, {
      device: this.connectedDevice,
    });
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(state: BluetoothConnectionState, data?: any): void {
    this.connectionState = state;
    for (const listener of this.listeners) {
      try {
        listener(state, data);
      } catch (err) {
        console.error('Error in bluetooth listener callback:', err);
      }
    }
  }

  /**
   * Scans for physical ESP32 biometric scanners broadcasting the Service UUID
   * or matching the 'AuditFlow_Scanner_' fleet prefix.
   */
  public async scanForDevices(): Promise<BluetoothDevice[]> {
    if (!this.bleManager) {
      this.initBleManager();
      if (!this.bleManager) {
        throw new Error('Bluetooth LE manager could not be initialized on this platform.');
      }
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth & Location permissions are required to scan for scanners.');
    }

    const adapterState = await this.bleManager.state();
    if (adapterState !== BleState.PoweredOn) {
      throw new Error(`Bluetooth is currently ${adapterState}. Please turn on Bluetooth.`);
    }

    this.notifyListeners('SCANNING');
    this.discoveredDevicesMap.clear();

    return new Promise<BluetoothDevice[]>((resolve, reject) => {
      // 8-second scan duration window
      const scanTimer = setTimeout(() => {
        try {
          this.bleManager?.stopDeviceScan();
        } catch (e) {
          // ignore
        }
        this.notifyListeners(this.connectedDevice ? 'CONNECTED' : 'DISCONNECTED');
        resolve(Array.from(this.discoveredDevicesMap.values()));
      }, 8000);

      try {
        this.bleManager!.startDeviceScan(
          [ESP32_SERVICE_UUID, ESP32_SERVICE_UUID_UPPER],
          { allowDuplicates: false },
          (error, device) => {
            if (error) {
              clearTimeout(scanTimer);
              this.notifyListeners('ERROR', { error: error.message });
              reject(new Error(error.message || 'BLE Scan failed.'));
              return;
            }

            if (device) {
              const name = device.name || device.localName || 'AuditFlow Scanner (Unnamed)';
              const isMatch =
                name.startsWith('AuditFlow_Scanner') ||
                device.serviceUUIDs?.some(
                  (u) =>
                    u.toLowerCase() === ESP32_SERVICE_UUID ||
                    u.toUpperCase() === ESP32_SERVICE_UUID_UPPER
                );

              if (isMatch) {
                const scannerDevice: BluetoothDevice = {
                  id: device.id,
                  name: name,
                  rssi: device.rssi ?? -60,
                  isConnected: false,
                };
                this.discoveredDevicesMap.set(device.id, scannerDevice);
                this.notifyListeners('SCANNING', {
                  discovered: Array.from(this.discoveredDevicesMap.values()),
                });
              }
            }
          }
        );
      } catch (err: any) {
        clearTimeout(scanTimer);
        this.notifyListeners('ERROR', { error: err.message });
        reject(err);
      }
    });
  }

  /**
   * Connects to a specific ESP32 scanner by ID and sets up GATT notification listener.
   */
  public async connect(deviceId: string): Promise<boolean> {
    if (!this.bleManager) {
      throw new Error('Bluetooth LE manager not ready.');
    }

    try {
      this.bleManager.stopDeviceScan();
    } catch (e) {
      // ignore
    }

    this.notifyListeners('CONNECTING');

    try {
      // 1. Connect to physical peripheral
      const device = await this.bleManager.connectToDevice(deviceId, {
        autoConnect: false,
        timeout: 10000,
      });

      // 2. Discover all GATT services and characteristics
      const discoveredDevice = await device.discoverAllServicesAndCharacteristics();
      this.activeDeviceInstance = discoveredDevice;

      // 3. Monitor disconnects
      this.disconnectSubscription?.remove();
      this.disconnectSubscription = this.bleManager.onDeviceDisconnected(
        deviceId,
        (error, disconnectedDev) => {
          console.warn(`[BLE] Device ${disconnectedDev?.id} disconnected:`, error?.message);
          this.handleDeviceDisconnected();
        }
      );

      // 4. Subscribe to TX Characteristic notifications (6E400003-B5A3-F393-E0A9-E50E24DCCA9E)
      this.charSubscription?.remove();
      this.charSubscription = discoveredDevice.monitorCharacteristicForService(
        ESP32_SERVICE_UUID,
        ESP32_TX_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('[BLE] Notification error:', error);
            return;
          }
          if (characteristic?.value) {
            this.handleIncomingBlePacket(characteristic.value);
          }
        }
      );

      const deviceName =
        discoveredDevice.name ||
        discoveredDevice.localName ||
        this.discoveredDevicesMap.get(deviceId)?.name ||
        'AuditFlow ESP32 Scanner';

      this.connectedDevice = {
        id: discoveredDevice.id,
        name: deviceName,
        rssi: (await discoveredDevice.readRSSI().then((d) => d.rssi).catch(() => -60)) || -60,
        isConnected: true,
      };

      this.notifyListeners('CONNECTED', { device: this.connectedDevice });
      return true;
    } catch (err: any) {
      console.error('[BLE] Connection error:', err);
      this.notifyListeners('ERROR', { error: err?.message || 'Failed to connect to scanner' });
      throw new Error(err?.message || 'Failed to connect to ESP32 scanner.');
    }
  }

  /**
   * Handles incoming Base64-encoded packets from ESP32 JM101B TX stream.
   * Protocol sequence:
   * 1. "SOF" marker -> Start of File (clear buffers)
   * 2. ~26 chunks of 20 bytes -> 512 pure DSP template bytes
   * 3. "EOF" marker -> End of File (stitch buffer, compute SHA-256 digest)
   */
  private handleIncomingBlePacket(base64Payload: string): void {
    try {
      const rawBytes = base64ToBytes(base64Payload);
      const textHeader = bytesToString(rawBytes);

      // 1. Check for Start of File (SOF)
      if (textHeader === 'SOF') {
        console.log('[BLE] << Received SOF (Start of Biometric Stream)');
        this.isCapturingTemplate = true;
        this.templateByteChunks = [];
        this.totalBytesBuffered = 0;
        this.notifyListeners('SCANNING_FINGER', { status: 'Receiving biometric template...' });
        return;
      }

      // 2. Check for End of File (EOF)
      if (textHeader === 'EOF') {
        console.log(`[BLE] << Received EOF. Total bytes received: ${this.totalBytesBuffered}`);
        this.isCapturingTemplate = false;

        // Reconstruct full 512-byte template
        const fullTemplate = new Uint8Array(this.totalBytesBuffered);
        let currentOffset = 0;
        for (const chunk of this.templateByteChunks) {
          fullTemplate.set(chunk, currentOffset);
          currentOffset += chunk.length;
        }

        // Validate payload length
        if (fullTemplate.length < 256) {
          const err = new Error(
            `Incomplete template received from sensor (${fullTemplate.length} bytes / expected 512 bytes).`
          );
          if (this.pendingScanReject) {
            this.pendingScanReject(err);
            this.pendingScanReject = null;
            this.pendingScanResolve = null;
          }
          this.notifyListeners('CONNECTED', { error: err.message });
          return;
        }

        // Compute standard SHA-256 hex hash from 512 raw DSP bytes
        const templateHash = sha256Binary(fullTemplate);
        const qualityScore = calculateTemplateQuality(fullTemplate);
        const timestamp = new Date().toISOString();

        const scanResult: BiometricScanResult = {
          templateHash,
          qualityScore,
          timestamp,
          rawBytesPreview: `ESP32_JM101B::SZ:${fullTemplate.length}B::${templateHash.slice(0, 16)}...`,
        };

        if (this.scanTimeoutTimer) {
          clearTimeout(this.scanTimeoutTimer);
          this.scanTimeoutTimer = null;
        }

        if (this.pendingScanResolve) {
          this.pendingScanResolve(scanResult);
          this.pendingScanResolve = null;
          this.pendingScanReject = null;
        }

        this.notifyListeners('CONNECTED', { scanResult });
        return;
      }

      // 3. Intermediate Binary Chunk
      if (this.isCapturingTemplate && rawBytes.length > 0) {
        this.templateByteChunks.push(rawBytes);
        this.totalBytesBuffered += rawBytes.length;
        console.log(`[BLE] + Buffered chunk (${rawBytes.length}B). Total: ${this.totalBytesBuffered}B`);
      }
    } catch (err) {
      console.error('[BLE] Packet parsing error:', err);
    }
  }

  /**
   * Arms scanner listener and waits for physical touch on the optical sensor.
   * When farmer places finger on JM101B glass, ESP32 transmits SOF -> chunks -> EOF.
   */
  public async triggerBiometricScan(timeoutMs: number = 35000): Promise<BiometricScanResult> {
    if (this.connectionState !== 'CONNECTED' || !this.connectedDevice) {
      throw new Error('ESP32 Bluetooth scanner is not connected. Please pair your scanner first.');
    }

    // Reset buffer state
    this.isCapturingTemplate = false;
    this.templateByteChunks = [];
    this.totalBytesBuffered = 0;
    this.notifyListeners('SCANNING_FINGER', {
      prompt: 'Please place farmer finger on the ESP32 optical sensor...',
    });

    return new Promise<BiometricScanResult>((resolve, reject) => {
      this.pendingScanResolve = resolve;
      this.pendingScanReject = reject;

      this.scanTimeoutTimer = setTimeout(() => {
        this.pendingScanResolve = null;
        this.pendingScanReject = null;
        this.isCapturingTemplate = false;
        this.notifyListeners('CONNECTED');
        reject(
          new Error(
            'Biometric scan timed out. Ensure the ESP32 scanner is powered and finger is firmly placed.'
          )
        );
      }, timeoutMs);
    });
  }

  /**
   * Disconnects from current ESP32 scanner peripheral.
   */
  public async disconnect(): Promise<void> {
    try {
      this.charSubscription?.remove();
      this.charSubscription = null;
      this.disconnectSubscription?.remove();
      this.disconnectSubscription = null;

      if (this.activeDeviceInstance) {
        await this.activeDeviceInstance.cancelConnection();
      }
    } catch (err) {
      console.warn('[BLE] Disconnect error:', err);
    } finally {
      this.handleDeviceDisconnected();
    }
  }

  private handleDeviceDisconnected(): void {
    this.connectedDevice = null;
    this.activeDeviceInstance = null;
    this.charSubscription?.remove();
    this.charSubscription = null;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
    this.isCapturingTemplate = false;
    this.templateByteChunks = [];
    this.totalBytesBuffered = 0;

    if (this.pendingScanReject) {
      this.pendingScanReject(new Error('ESP32 scanner disconnected during biometric capture.'));
      this.pendingScanReject = null;
      this.pendingScanResolve = null;
    }

    this.notifyListeners('DISCONNECTED');
  }
}

export const bluetoothService = new BluetoothService();
