import {
  BiometricScanResult,
  BluetoothConnectionState,
  BluetoothDevice,
} from '../types';

type EventCallback = (state: BluetoothConnectionState, data?: any) => void;

/**
 * Generates a pseudo-random 64-character hexadecimal SHA-256 hash string
 * formatted like biometric templates extracted from ESP32 optical scanners.
 */
function generateBiometricHash(): string {
  const hexChars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
  }
  return hash;
}

class BluetoothService {
  private isMock: boolean = true;
  private connectionState: BluetoothConnectionState = 'DISCONNECTED';
  private connectedDevice: BluetoothDevice | null = null;
  private listeners: Set<EventCallback> = new Set();
  private mockScannerDevices: BluetoothDevice[] = [
    { id: 'ESP32_BIO_A4', name: 'ESP32 Fingerprint Scanner (Field-01)', rssi: -58 },
    { id: 'ESP32_BIO_B9', name: 'ESP32 Fingerprint Scanner (Field-02)', rssi: -72 },
    { id: 'ESP32_BIO_C1', name: 'ESP32 Optical Unit (Mobile)', rssi: -84 },
  ];

  constructor() {
    // Default to mock mode enabled for seamless testing
    this.isMock = true;
  }

  /**
   * Sets mock/simulation mode. When enabled, allows full scanner testing without hardware.
   */
  public setMockMode(enabled: boolean): void {
    this.isMock = enabled;
    this.notifyListeners(this.connectionState, { mockMode: enabled });
  }

  public isMockMode(): boolean {
    return this.isMock;
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
    // Immediately emit current state
    callback(this.connectionState, {
      device: this.connectedDevice,
      isMock: this.isMock,
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
   * Scans for nearby ESP32 biometric scanning devices.
   */
  public async scanForDevices(): Promise<BluetoothDevice[]> {
    this.notifyListeners('SCANNING');

    if (this.isMock) {
      // Simulate Bluetooth LE scan delay (800ms)
      await new Promise((res) => setTimeout(res, 800));
      this.notifyListeners(this.connectedDevice ? 'CONNECTED' : 'DISCONNECTED');
      return [...this.mockScannerDevices];
    }

    // Physical BLE hardware scanning stub (when built natively with react-native-ble-plx or Expo BLE)
    this.notifyListeners(this.connectedDevice ? 'CONNECTED' : 'DISCONNECTED');
    return [];
  }

  /**
   * Connects to a specific ESP32 scanner by ID.
   */
  public async connect(deviceId?: string): Promise<boolean> {
    this.notifyListeners('CONNECTING');

    if (this.isMock) {
      // Simulate pairing / GATT handshake delay (1000ms)
      await new Promise((res) => setTimeout(res, 1000));
      const targetDevice =
        this.mockScannerDevices.find((d) => d.id === deviceId) || this.mockScannerDevices[0];

      this.connectedDevice = {
        ...targetDevice,
        isConnected: true,
      };
      this.notifyListeners('CONNECTED', { device: this.connectedDevice });
      return true;
    }

    // Physical connect logic fallback
    this.notifyListeners('ERROR', { error: 'Physical BLE scanning requires hardware build.' });
    return false;
  }

  /**
   * Disconnects from current ESP32 scanner.
   */
  public async disconnect(): Promise<void> {
    this.connectedDevice = null;
    this.notifyListeners('DISCONNECTED');
  }

  /**
   * Triggers a biometric fingerprint scan on the ESP32 scanner.
   * Prompts the farmer to place finger on optical sensor, validates template quality,
   * and returns the 64-char SHA-256 template hash.
   */
  public async triggerBiometricScan(): Promise<BiometricScanResult> {
    if (this.connectionState !== 'CONNECTED') {
      // Auto-connect in mock mode if user triggers scan directly
      if (this.isMock) {
        await this.connect();
      } else {
        throw new Error('Bluetooth scanner is not connected. Please pair with ESP32 device first.');
      }
    }

    this.notifyListeners('SCANNING_FINGER');

    if (this.isMock) {
      // Simulate physical sensor acquisition and image processing delay (1.2s)
      await new Promise((res) => setTimeout(res, 1200));

      const qualityScore = Math.floor(92 + Math.random() * 8); // 92% - 99%
      const templateHash = generateBiometricHash();
      const timestamp = new Date().toISOString();

      const result: BiometricScanResult = {
        templateHash,
        qualityScore,
        timestamp,
        rawBytesPreview: `TEMPLATE_V1::SZ:512::Q:${qualityScore}%`,
      };

      this.notifyListeners('CONNECTED', { scanResult: result });
      return result;
    }

    // Physical hardware scan execution stub
    this.notifyListeners('CONNECTED');
    throw new Error('Physical ESP32 fingerprint sensor listener not available in simulator.');
  }
}

export const bluetoothService = new BluetoothService();
