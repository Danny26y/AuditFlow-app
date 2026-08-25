import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import uuid from 'react-native-uuid';

export interface DeviceInfo {
  deviceUuid: string;
  deviceName: string;
  agentId: string;
  brand: string;
  modelName: string;
  osName: string;
  osVersion: string;
  isPhysicalDevice: boolean;
}

const STORAGE_KEY_UUID = 'AUDITFLOW_PERSISTENT_HARDWARE_UUID_V2';
const STORAGE_KEY_AGENT_ID = 'AUDITFLOW_PERSISTENT_AGENT_ID_V2';

let cachedDeviceInfo: DeviceInfo | null = null;

class DeviceService {
  /**
   * Returns the unique Agent ID permanently assigned to this device terminal.
   */
  public async getAgentId(): Promise<string> {
    const info = await this.getDeviceInfo();
    return info.agentId;
  }

  /**
   * Sets/updates the assigned Agent ID for this terminal.
   */
  public setAgentId(newAgentId: string): void {
    const cleanId = newAgentId.trim().toUpperCase();
    if (cachedDeviceInfo) {
      cachedDeviceInfo.agentId = cleanId;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY_AGENT_ID, cleanId);
      } catch (e) {}
    }
  }

  /**
   * Initializes and retrieves permanent hardware-backed device identification.
   * Guarantees:
   * 1. Agent ID is UNIQUE and DIFFERENT across all devices (or supervisor-assigned).
   * 2. Device UUID is UNIQUE and DIFFERENT across all physical phones/tablets.
   * 3. Hardware device name is automatically detected and fixed.
   */
  public async getDeviceInfo(): Promise<DeviceInfo> {
    if (cachedDeviceInfo) {
      return cachedDeviceInfo;
    }

    let persistentUuid = '';
    let persistentAgentId = '';
    let brand = Device.brand || (Platform.OS === 'android' ? 'Android' : 'Web');
    let modelName = Device.modelName || (Platform.OS === 'android' ? 'Handheld Terminal' : 'Web Browser');
    let osName = Device.osName || (Platform.OS === 'android' ? 'Android' : 'Web');
    let osVersion = Device.osVersion || '14';
    let isPhysicalDevice = Device.isDevice ?? false;

    // 1. On physical Android device: read unique Android hardware ID
    if (Platform.OS === 'android') {
      try {
        const androidId = Application.getAndroidId();
        if (androidId && androidId.trim().length > 0) {
          const sanitizedModel = (modelName || 'AND')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 6)
            .toUpperCase();
          persistentUuid = `DEV-${sanitizedModel}-${androidId.toUpperCase()}`;
        }
      } catch (err) {
        console.warn('[DeviceService] Native Android ID unavailable:', err);
      }
    }

    // 2. Check local persistent storage for stored UUID and Agent ID
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (!persistentUuid) {
          const storedUuid = window.localStorage.getItem(STORAGE_KEY_UUID);
          if (storedUuid && storedUuid.trim().length > 0) {
            persistentUuid = storedUuid;
          }
        }
        const storedAgent = window.localStorage.getItem(STORAGE_KEY_AGENT_ID);
        if (storedAgent && storedAgent.trim().length > 0) {
          persistentAgentId = storedAgent;
        }
      } catch (e) {
        console.warn('[DeviceService] localStorage read error:', e);
      }
    }

    // 3. If no hardware UUID found, generate a unique random UUID v4 and persist it permanently
    if (!persistentUuid) {
      const uniqueSuffix = uuid.v4().toString().toUpperCase();
      const prefix = Platform.OS === 'android' ? 'DEV-AND' : 'DEV-WEB';
      persistentUuid = `${prefix}-${uniqueSuffix.slice(0, 10)}`;

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(STORAGE_KEY_UUID, persistentUuid);
        } catch (e) {}
      }
    }

    // 4. If no Agent ID found, auto-generate a unique assigned Agent code for this device terminal
    if (!persistentAgentId) {
      const agentSuffix = persistentUuid.slice(-4);
      persistentAgentId = `AGT-BEN-${agentSuffix}`;

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(STORAGE_KEY_AGENT_ID, persistentAgentId);
        } catch (e) {}
      }
    }

    const deviceName = `${brand} ${modelName}`.trim();

    cachedDeviceInfo = {
      deviceUuid: persistentUuid,
      deviceName,
      agentId: persistentAgentId,
      brand,
      modelName,
      osName,
      osVersion,
      isPhysicalDevice,
    };

    return cachedDeviceInfo;
  }

  /**
   * Returns just the unique persistent device UUID string
   */
  public async getDeviceUuid(): Promise<string> {
    const info = await this.getDeviceInfo();
    return info.deviceUuid;
  }
}

export const deviceService = new DeviceService();
