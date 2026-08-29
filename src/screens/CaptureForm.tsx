import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { FarmerInput } from '../types';
import { insertFarmerRecord, DatabaseConstraintError } from '../db/database';
import { bluetoothService } from '../services/bluetooth';
import { deviceService, DeviceInfo } from '../services/deviceService';
import { validateFarmerInput, ValidationErrors } from '../utils/validation';
import {
  BENUE_AGRICULTURAL_CLUSTERS,
  getBenueLGAs,
  getWardsForLGA,
  findBenueCluster,
  BenueCluster,
} from '../constants/benueLocations';

export type LocationMode = 'TOWN_HALL' | 'LIVE_GPS' | 'MANUAL_COORDINATES';

export const PRESET_CROPS = [
  { id: 'Maize', label: '🌽 Maize' },
  { id: 'Rice', label: '🌾 Rice' },
  { id: 'Cassava', label: '🥔 Cassava' },
  { id: 'Cocoa', label: '🍫 Cocoa' },
  { id: 'Sorghum', label: '🌾 Sorghum' },
  { id: 'Soybeans', label: '🌱 Soybeans' },
  { id: 'Yam', label: '🍠 Yam' },
  { id: 'Sesame', label: '🌿 Sesame' },
  { id: 'Groundnut', label: '🥜 Groundnut' },
  { id: 'Tomatoes', label: '🍅 Vegetables' },
  { id: 'Oil Palm', label: '🌴 Oil Palm' },
  { id: 'Wheat', label: '🌾 Wheat' },
];

export const PRESET_LIVESTOCK = [
  { id: 'Cattle/Beef', label: '🐂 Cattle / Beef' },
  { id: 'Dairy Cattle', label: '🥛 Dairy Cattle' },
  { id: 'Goats', label: '🐐 Goats' },
  { id: 'Sheep', label: '🐑 Sheep' },
  { id: 'Poultry (Broilers)', label: '🐔 Poultry (Broilers)' },
  { id: 'Poultry (Layers)', label: '🥚 Poultry (Layers)' },
  { id: 'Catfish / Fish', label: '🐟 Catfish / Aquaculture' },
  { id: 'Pigs / Swine', label: '🐖 Pigs / Swine' },
  { id: 'Rabbits', label: '🐇 Rabbits' },
  { id: 'Apiculture (Bees)', label: '🐝 Beekeeping / Honey' },
  { id: 'Snails', label: '🐌 Heliculture / Snails' },
];

export interface CaptureFormProps {
  onRecordSaved?: () => void;
}

export default function CaptureForm({ onRecordSaved }: CaptureFormProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 480; // Responsive breakpoint for mobile phones

  // Device & Hardware Detection
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // Form State - 18 columns
  const [agentId, setAgentId] = useState<string>('AGT-8821');
  const [deviceUuid, setDeviceUuid] = useState<string>('DEV-INITIALIZING');
  const [farmerName, setFarmerName] = useState<string>('');
  const [nin, setNin] = useState<string>('');
  const [bvn, setBvn] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [lga, setLga] = useState<string>('Gboko');
  const [communityWard, setCommunityWard] = useState<string>('Mkar');
  const [cooperativeName, setCooperativeName] = useState<string>('');

  // Primary Farm Produce & Livestock State (Multi-selection & Typed tags)
  const [selectedProduces, setSelectedProduces] = useState<string[]>(['Soybeans', 'Maize', 'Yam']);
  const [customProduceInput, setCustomProduceInput] = useState<string>('');

  const [farmSizeHectares, setFarmSizeHectares] = useState<string>('');
  const [estimatedYieldTonnes, setEstimatedYieldTonnes] = useState<string>('');
  const [farmLocation, setFarmLocation] = useState<string>('Mkar Hill Agrarian Basin — High-density soybean & cereal cluster');

  // Dual-Mode Geolocation State
  const [locationMode, setLocationMode] = useState<LocationMode>('TOWN_HALL');
  const [selectedClusterLGA, setSelectedClusterLGA] = useState<string>('Gboko');
  const [selectedClusterWard, setSelectedClusterWard] = useState<string>('Mkar');
  const [selectedClusterInfo, setSelectedClusterInfo] = useState<BenueCluster | undefined>(BENUE_AGRICULTURAL_CLUSTERS[0]);
  const [manualLatStr, setManualLatStr] = useState<string>('7.35412');
  const [manualLngStr, setManualLngStr] = useState<string>('9.04321');

  const [latitude, setLatitude] = useState<number | null>(7.35412);
  const [longitude, setLongitude] = useState<number | null>(9.04321);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [biometricHash, setBiometricHash] = useState<string>('');
  const [bioQualityScore, setBioQualityScore] = useState<number | null>(null);

  // Status & UI States
  const [isLoadingGps, setIsLoadingGps] = useState<boolean>(false);
  const [isScanningBio, setIsScanningBio] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pairedScanner, setPairedScanner] = useState<any>(bluetoothService.getConnectedDevice());
  const [bleConnectionState, setBleConnectionState] = useState<string>(bluetoothService.getConnectionState());
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [highContrastMode, setHighContrastMode] = useState<boolean>(true);

  // Active Category Tab for selection
  const [produceCategory, setProduceCategory] = useState<'CROPS' | 'LIVESTOCK' | 'CUSTOM'>('CROPS');

  // Initialize Persistent Device Identity, Bluetooth state and GPS
  useEffect(() => {
    // Auto-detect hardware & persistent device UUID
    async function initDevice() {
      try {
        const info = await deviceService.getDeviceInfo();
        setDeviceInfo(info);
        setDeviceUuid(info.deviceUuid);
        setAgentId(info.agentId);
      } catch (e) {
        console.warn('Device detection error:', e);
      }
    }
    initDevice();

    const unsubscribeBio = bluetoothService.addListener((state, data) => {
      setBleConnectionState(state);
      if (data?.device !== undefined) {
        setPairedScanner(data.device);
      }
      if (state === 'SCANNING_FINGER') {
        setIsScanningBio(true);
      } else {
        setIsScanningBio(false);
        if (data?.scanResult) {
          setBiometricHash(data.scanResult.templateHash);
          setBioQualityScore(data.scanResult.qualityScore);
          setErrors((prev) => ({ ...prev, biometric_template_hash: undefined }));
        }
      }
    });

    return () => {
      unsubscribeBio();
    };
  }, []);

  /**
   * Toggles a crop or livestock item in/out of the selected multi-selection array
   */
  const handleToggleProduceItem = (itemId: string) => {
    setErrors((prev) => ({ ...prev, crop_type: undefined }));
    if (selectedProduces.includes(itemId)) {
      setSelectedProduces(selectedProduces.filter((item) => item !== itemId));
    } else {
      setSelectedProduces([...selectedProduces, itemId]);
    }
  };

  /**
   * Adds custom entered produce/livestock text (supports comma-separated multiple entries)
   */
  const handleAddCustomProduce = () => {
    if (!customProduceInput.trim()) return;

    const itemsToAdd = customProduceInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !selectedProduces.includes(s));

    if (itemsToAdd.length > 0) {
      setSelectedProduces([...selectedProduces, ...itemsToAdd]);
      setCustomProduceInput('');
      setErrors((prev) => ({ ...prev, crop_type: undefined }));
    }
  };

  const handleRemoveProduceItem = (itemToRemove: string) => {
    setSelectedProduces(selectedProduces.filter((item) => item !== itemToRemove));
  };

  /**
   * Handles selecting a Benue LGA in Town Hall / Centroid Mode
   */
  const handleSelectClusterLGA = (lgaName: string) => {
    setSelectedClusterLGA(lgaName);
    setLga(lgaName);
    setErrors((prev) => ({ ...prev, lga: undefined }));

    const wards = getWardsForLGA(lgaName);
    if (wards.length > 0) {
      const firstWard = wards[0];
      setSelectedClusterWard(firstWard.ward_community);
      setCommunityWard(firstWard.ward_community);
      setSelectedClusterInfo(firstWard);
      setLatitude(firstWard.centroid_latitude);
      setLongitude(firstWard.centroid_longitude);
      setFarmLocation(firstWard.description);
      setErrors((prev) => ({ ...prev, community_ward: undefined, latitude: undefined, longitude: undefined }));
    }
  };

  /**
   * Handles selecting an Agricultural Ward / Community in Town Hall / Centroid Mode
   */
  const handleSelectClusterWard = (wardName: string) => {
    setSelectedClusterWard(wardName);
    setCommunityWard(wardName);
    setErrors((prev) => ({ ...prev, community_ward: undefined }));

    const cluster = findBenueCluster(selectedClusterLGA, wardName);
    if (cluster) {
      setSelectedClusterInfo(cluster);
      setLatitude(cluster.centroid_latitude);
      setLongitude(cluster.centroid_longitude);
      setFarmLocation(cluster.description);
      setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));
    }
  };

  /**
   * Handles Location Mode Switch (Town Hall Centroid vs Live GPS vs Manual Override)
   */
  const handleLocationModeChange = (newMode: LocationMode) => {
    setLocationMode(newMode);
    setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));

    if (newMode === 'TOWN_HALL') {
      const cluster = findBenueCluster(selectedClusterLGA, selectedClusterWard) || BENUE_AGRICULTURAL_CLUSTERS[0];
      setSelectedClusterInfo(cluster);
      setLatitude(cluster.centroid_latitude);
      setLongitude(cluster.centroid_longitude);
      setGpsAccuracy(null);
    } else if (newMode === 'LIVE_GPS') {
      fetchGpsLocation();
    } else if (newMode === 'MANUAL_COORDINATES') {
      setManualLatStr(latitude !== null ? latitude.toString() : '7.35412');
      setManualLngStr(longitude !== null ? longitude.toString() : '9.04321');
    }
  };

  /**
   * Handles manual latitude numeric entry
   */
  const handleManualLatChange = (text: string) => {
    setManualLatStr(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed >= -90 && parsed <= 90) {
      setLatitude(parsed);
      setErrors((prev) => ({ ...prev, latitude: undefined }));
    } else {
      setLatitude(null);
    }
  };

  /**
   * Handles manual longitude numeric entry
   */
  const handleManualLngChange = (text: string) => {
    setManualLngStr(text);
    const parsed = parseFloat(text);
    if (!isNaN(parsed) && parsed >= -180 && parsed <= 180) {
      setLongitude(parsed);
      setErrors((prev) => ({ ...prev, longitude: undefined }));
    } else {
      setLongitude(null);
    }
  };

  /**
   * Acquires high-accuracy GPS coordinates using expo-location (Mode B)
   */
  const fetchGpsLocation = async () => {
    setIsLoadingGps(true);
    setErrors((prev) => ({ ...prev, latitude: undefined, longitude: undefined }));

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLatitude(7.35412); // Benue Gboko center fallback
        setLongitude(9.04321);
        setGpsAccuracy(15);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(Number(location.coords.latitude.toFixed(6)));
      setLongitude(Number(location.coords.longitude.toFixed(6)));
      setGpsAccuracy(Math.round(location.coords.accuracy || 5));
    } catch (err: any) {
      console.warn('Could not fetch exact GPS, using fallback cluster coordinates:', err);
      const cluster = findBenueCluster(selectedClusterLGA, selectedClusterWard) || BENUE_AGRICULTURAL_CLUSTERS[0];
      setLatitude(cluster.centroid_latitude);
      setLongitude(cluster.centroid_longitude);
      setGpsAccuracy(8);
    } finally {
      setIsLoadingGps(false);
    }
  };

  /**
   * Triggers biometric fingerprint capture on ESP32 scanner (or mock)
   */
  const handleScanBiometrics = async () => {
    setIsScanningBio(true);
    try {
      const result = await bluetoothService.triggerBiometricScan();
      setBiometricHash(result.templateHash);
      setBioQualityScore(result.qualityScore);
      setErrors((prev) => ({ ...prev, biometric_template_hash: undefined }));
    } catch (err: any) {
      Alert.alert('Scanner Error', err?.message || 'Failed to capture fingerprint from ESP32 scanner.');
    } finally {
      setIsScanningBio(false);
    }
  };

  /**
   * Generates a sample test farmer rotating through real Benue agrarian clusters
   */
  const handleFillSampleData = () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const sampleNin = `0123456${randomSuffix}`;
    const sampleBvn = `0987654${randomSuffix}`;

    // Pick a random Benue agricultural cluster
    const clusterIndex = Math.floor(Math.random() * BENUE_AGRICULTURAL_CLUSTERS.length);
    const cluster = BENUE_AGRICULTURAL_CLUSTERS[clusterIndex];

    setSelectedClusterLGA(cluster.lga);
    setSelectedClusterWard(cluster.ward_community);
    setSelectedClusterInfo(cluster);
    setLga(cluster.lga);
    setCommunityWard(cluster.ward_community);
    setLatitude(cluster.centroid_latitude);
    setLongitude(cluster.centroid_longitude);
    setManualLatStr(cluster.centroid_latitude.toString());
    setManualLngStr(cluster.centroid_longitude.toString());
    setFarmLocation(cluster.description);

    const produceList = cluster.default_crop.split(',').map((s) => s.trim());
    setSelectedProduces(produceList);

    const firstNames = ['Terseer', 'Dooshima', 'Iorwuese', 'Ngizan', 'Aondover', 'Bem', 'Kator', 'Sewuese', 'Msugh', 'Hembafan'];
    const lastNames = ['Agbo', 'Iorliam', 'Tor', 'Tyover', 'Gbenda', 'Orduen', 'Asema', 'Chia', 'Gbande', 'Utsaha'];
    const chosenName = `${firstNames[randomSuffix % firstNames.length]} ${lastNames[randomSuffix % lastNames.length]}`;

    setFarmerName(`${chosenName} (${randomSuffix})`);
    setNin(sampleNin);
    setBvn(sampleBvn);
    setPhoneNumber(`0803${randomSuffix}78`);
    setCooperativeName(`${cluster.lga} ${cluster.ward_community} Agrarian Producers Cooperative`);
    setFarmSizeHectares((2.5 + (randomSuffix % 6) * 0.5).toFixed(1));
    setEstimatedYieldTonnes((8.0 + (randomSuffix % 10) * 1.2).toFixed(1));
    setSuccessBanner(null);
    setErrors({});
    handleScanBiometrics();
  };

  const handleResetForm = () => {
    const defaultCluster = BENUE_AGRICULTURAL_CLUSTERS[0];
    setFarmerName('');
    setNin('');
    setBvn('');
    setPhoneNumber('');
    setSelectedClusterLGA(defaultCluster.lga);
    setSelectedClusterWard(defaultCluster.ward_community);
    setSelectedClusterInfo(defaultCluster);
    setLga(defaultCluster.lga);
    setCommunityWard(defaultCluster.ward_community);
    setLatitude(defaultCluster.centroid_latitude);
    setLongitude(defaultCluster.centroid_longitude);
    setManualLatStr(defaultCluster.centroid_latitude.toString());
    setManualLngStr(defaultCluster.centroid_longitude.toString());
    setCooperativeName('');
    setSelectedProduces(['Soybeans', 'Maize', 'Yam']);
    setCustomProduceInput('');
    setFarmSizeHectares('');
    setEstimatedYieldTonnes('');
    setFarmLocation(defaultCluster.description);
    setBiometricHash('');
    setBioQualityScore(null);
    setErrors({});
    setSuccessBanner(null);
  };

  /**
   * Validates and submits the 18-column farmer demographic record to SQLite
   */
  const handleSubmit = async () => {
    setSuccessBanner(null);
    setErrors({});

    // Serializes multiple produce & livestock entries as comma-separated string
    const formattedProduceString = selectedProduces.join(', ').trim();

    const recordInput: Partial<FarmerInput> = {
      agent_id: agentId,
      device_uuid: deviceUuid,
      farmer_name: farmerName,
      nin: nin.trim(), // Strict 11-digit string
      bvn: bvn.trim(), // Strict 11-digit string
      phone_number: phoneNumber.trim(),
      lga: lga.trim(),
      community_ward: communityWard.trim(),
      cooperative_name: cooperativeName.trim(),
      crop_type: formattedProduceString,
      farm_size_hectares: parseFloat(farmSizeHectares),
      estimated_yield_tonnes: parseFloat(estimatedYieldTonnes),
      farm_location: farmLocation.trim(),
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      biometric_template_hash: biometricHash,
    };

    const validation = validateFarmerInput(recordInput);
    if (!validation.isValid) {
      setErrors(validation.errors);
      Alert.alert('Validation Error', 'Please fix the highlighted errors before saving.');
      return;
    }

    setIsSubmitting(true);

    try {
      const savedRecord = await insertFarmerRecord(recordInput as FarmerInput);
      setSuccessBanner(
        `Farmer "${savedRecord.farmer_name}" saved to SQLite database successfully!\nProduce: ${savedRecord.crop_type}\nLocation: ${savedRecord.lga} (${savedRecord.community_ward})\nStatus: PENDING_SYNC`
      );
      handleResetForm();
      if (onRecordSaved) {
        onRecordSaved();
      }
    } catch (err: any) {
      if (err instanceof DatabaseConstraintError) {
        if (err.field) {
          setErrors((prev) => ({ ...prev, [err.field!]: err.message }));
        }
        Alert.alert('Duplicate Record Detected', err.message);
      } else {
        Alert.alert('Database Error', err?.message || 'Could not save record to SQLite database.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const benueLGAs = getBenueLGAs();
  const currentWards = getWardsForLGA(selectedClusterLGA);

  return (
    <ScrollView
      style={[styles.container, highContrastMode ? styles.containerHighContrast : styles.containerNormal]}
      contentContainerStyle={styles.contentContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Bar - Responsive layout */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerBadge}>OFFLINE CAPTURE</Text>
          <View style={styles.contrastToggleRow}>
            <Text style={styles.contrastToggleLabel}>Daylight Mode</Text>
            <Switch
              value={highContrastMode}
              onValueChange={setHighContrastMode}
              trackColor={{ false: '#767577', true: '#0052CC' }}
            />
          </View>
        </View>

        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          AuditFlow Field Registry
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          Dual-Mode 18-Column Agrarian & Livestock Capture Engine
        </Text>

        {deviceInfo && (
          <View style={styles.deviceHeaderBadge}>
            <Text style={styles.deviceHeaderText} numberOfLines={1}>
              📱 {deviceInfo.deviceName} ({deviceInfo.osName} {deviceInfo.osVersion}) • Terminal: {deviceInfo.deviceUuid}
            </Text>
          </View>
        )}
      </View>

      {/* Success Notification Banner */}
      {successBanner && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerTitle}>✓ Registration Saved</Text>
          <Text style={styles.successBannerText}>{successBanner}</Text>
        </View>
      )}

      {/* Quick Test Actions */}
      <View style={[styles.quickActionsRow, isCompact ? styles.quickActionsColumn : null]}>
        <TouchableOpacity style={styles.sampleDataButton} onPress={handleFillSampleData}>
          <Text style={styles.sampleDataButtonText}>⚡ Autofill Benue Cluster Sample</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetButton} onPress={handleResetForm}>
          <Text style={styles.resetButtonText}>↺ Reset</Text>
        </TouchableOpacity>
      </View>

      {/* 1. AGENT & DEVICE INFO (FIXED & LOCKED) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardHeader, { marginBottom: 0 }]}>1. Session & Device Identifiers</Text>
          <Text style={styles.lockedBadge}>🔒 Immutable Hardware Anchor</Text>
        </View>

        <View style={isCompact ? styles.columnLayout : styles.rowLayout}>
          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfLeft]}>
            <View style={styles.labelWithHint}>
              <Text style={styles.label}>Agent ID</Text>
              <Text style={styles.lockedSubBadge}>🔒 Fixed</Text>
            </View>
            <TextInput
              style={[styles.input, styles.lockedInput]}
              value={agentId}
              editable={false}
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfRight]}>
            <View style={styles.labelWithHint}>
              <Text style={styles.label}>Device UUID</Text>
              <Text style={styles.lockedSubBadge}>🔒 Unique Hardware</Text>
            </View>
            <TextInput
              style={[styles.input, styles.lockedInput]}
              value={deviceUuid}
              editable={false}
              placeholderTextColor="#64748B"
            />
          </View>
        </View>

        {deviceInfo && (
          <View style={styles.detectedHardwareRow}>
            <Text style={styles.detectedHardwareLabel}>📱 Device Terminal:</Text>
            <Text style={styles.detectedHardwareValue} numberOfLines={1}>
              {deviceInfo.deviceName} ({deviceInfo.osName} {deviceInfo.osVersion})
            </Text>
          </View>
        )}
      </View>

      {/* 2. FARMER DEMOGRAPHICS & IDENTIFIERS */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>2. Farmer Demographics & Identifiers</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Farmer Full Name *</Text>
          <TextInput
            style={[styles.input, errors.farmer_name ? styles.inputError : null]}
            value={farmerName}
            onChangeText={(text) => {
              setFarmerName(text);
              if (errors.farmer_name) setErrors((prev) => ({ ...prev, farmer_name: undefined }));
            }}
            placeholder="e.g. Terseer Agbo"
            placeholderTextColor="#888"
          />
          {errors.farmer_name && <Text style={styles.errorText}>{errors.farmer_name}</Text>}
        </View>

        <View style={isCompact ? styles.columnLayout : styles.rowLayout}>
          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfLeft]}>
            <View style={styles.labelWithHint}>
              <Text style={styles.label}>NIN (11 Digits) *</Text>
              <Text style={styles.hintBadge}>Strict String</Text>
            </View>
            <TextInput
              style={[styles.input, errors.nin ? styles.inputError : null]}
              value={nin}
              onChangeText={(text) => {
                setNin(text);
                if (errors.nin) setErrors((prev) => ({ ...prev, nin: undefined }));
              }}
              placeholder="e.g. 01234567891"
              placeholderTextColor="#888"
              keyboardType="number-pad"
              maxLength={11}
            />
            {errors.nin && <Text style={styles.errorText}>{errors.nin}</Text>}
          </View>

          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfRight]}>
            <View style={styles.labelWithHint}>
              <Text style={styles.label}>BVN (11 Digits) *</Text>
              <Text style={styles.hintBadge}>Strict String</Text>
            </View>
            <TextInput
              style={[styles.input, errors.bvn ? styles.inputError : null]}
              value={bvn}
              onChangeText={(text) => {
                setBvn(text);
                if (errors.bvn) setErrors((prev) => ({ ...prev, bvn: undefined }));
              }}
              placeholder="e.g. 09876543210"
              placeholderTextColor="#888"
              keyboardType="number-pad"
              maxLength={11}
            />
            {errors.bvn && <Text style={styles.errorText}>{errors.bvn}</Text>}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Primary Phone Number *</Text>
          <TextInput
            style={[styles.input, errors.phone_number ? styles.inputError : null]}
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              if (errors.phone_number) setErrors((prev) => ({ ...prev, phone_number: undefined }));
            }}
            placeholder="e.g. 08031234567"
            placeholderTextColor="#888"
            keyboardType="phone-pad"
          />
          {errors.phone_number && <Text style={styles.errorText}>{errors.phone_number}</Text>}
        </View>
      </View>

      {/* 3. LOCATION & COOPERATIVE */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>3. Administrative & Cooperative Details</Text>

        <View style={isCompact ? styles.columnLayout : styles.rowLayout}>
          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfLeft]}>
            <Text style={styles.label}>LGA (Local Govt) *</Text>
            <TextInput
              style={[styles.input, errors.lga ? styles.inputError : null]}
              value={lga}
              onChangeText={(text) => {
                setLga(text);
                if (errors.lga) setErrors((prev) => ({ ...prev, lga: undefined }));
              }}
              placeholder="e.g. Gboko"
              placeholderTextColor="#888"
            />
            {errors.lga && <Text style={styles.errorText}>{errors.lga}</Text>}
          </View>

          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfRight]}>
            <Text style={styles.label}>Community / Ward *</Text>
            <TextInput
              style={[styles.input, errors.community_ward ? styles.inputError : null]}
              value={communityWard}
              onChangeText={(text) => {
                setCommunityWard(text);
                if (errors.community_ward) setErrors((prev) => ({ ...prev, community_ward: undefined }));
              }}
              placeholder="e.g. Mkar"
              placeholderTextColor="#888"
            />
            {errors.community_ward && <Text style={styles.errorText}>{errors.community_ward}</Text>}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Cooperative / Association Name *</Text>
          <TextInput
            style={[styles.input, errors.cooperative_name ? styles.inputError : null]}
            value={cooperativeName}
            onChangeText={(text) => {
              setCooperativeName(text);
              if (errors.cooperative_name) setErrors((prev) => ({ ...prev, cooperative_name: undefined }));
            }}
            placeholder="e.g. Gboko Central Agrarian & Livestock Union"
            placeholderTextColor="#888"
          />
          {errors.cooperative_name && <Text style={styles.errorText}>{errors.cooperative_name}</Text>}
        </View>
      </View>

      {/* 4. PRIMARY FARM PRODUCE & LIVESTOCK SPECIFICATIONS (MULTI-SELECT & TYPED) */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>4. Farm Produce & Livestock Specifications</Text>

        <View style={styles.fieldGroup}>
          <View style={styles.labelWithHint}>
            <Text style={[styles.label, { flexShrink: 1 }]}>Select Multiple Produce/Livestock *</Text>
            <Text style={styles.selectedCountBadge}>
              {selectedProduces.length} Selected
            </Text>
          </View>

          {/* Selected Produce Active Tag Chips */}
          <View style={styles.selectedChipsContainer}>
            {selectedProduces.length === 0 ? (
              <Text style={styles.noProduceSelectedText}>
                No produce/livestock selected yet. Tap options below or type to add.
              </Text>
            ) : (
              selectedProduces.map((item) => (
                <View key={item} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText} numberOfLines={1}>{item}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveProduceItem(item)}
                    style={styles.chipRemoveBtn}
                  >
                    <Text style={styles.chipRemoveBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Category Tabs: Crops / Livestock / Type Custom */}
          <View style={styles.categoryTabBar}>
            <TouchableOpacity
              style={[styles.catTab, produceCategory === 'CROPS' ? styles.catTabActive : null]}
              onPress={() => setProduceCategory('CROPS')}
            >
              <Text style={[styles.catTabText, produceCategory === 'CROPS' ? styles.catTabTextActive : null]} numberOfLines={1}>
                🌾 Crops
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.catTab, produceCategory === 'LIVESTOCK' ? styles.catTabActive : null]}
              onPress={() => setProduceCategory('LIVESTOCK')}
            >
              <Text style={[styles.catTabText, produceCategory === 'LIVESTOCK' ? styles.catTabTextActive : null]} numberOfLines={1}>
                🐂 Livestock
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.catTab, produceCategory === 'CUSTOM' ? styles.catTabActive : null]}
              onPress={() => setProduceCategory('CUSTOM')}
            >
              <Text style={[styles.catTabText, produceCategory === 'CUSTOM' ? styles.catTabTextActive : null]} numberOfLines={1}>
                ✍ Type Custom
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content: Preset Crops */}
          {produceCategory === 'CROPS' && (
            <View style={styles.pillContainer}>
              {PRESET_CROPS.map((crop) => {
                const isSelected = selectedProduces.includes(crop.id);
                return (
                  <TouchableOpacity
                    key={crop.id}
                    style={[styles.cropPill, isSelected ? styles.cropPillActive : null]}
                    onPress={() => handleToggleProduceItem(crop.id)}
                  >
                    <Text style={[styles.cropPillText, isSelected ? styles.cropPillTextActive : null]}>
                      {isSelected ? `✓ ${crop.label}` : crop.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Tab Content: Preset Livestock */}
          {produceCategory === 'LIVESTOCK' && (
            <View style={styles.pillContainer}>
              {PRESET_LIVESTOCK.map((beast) => {
                const isSelected = selectedProduces.includes(beast.id);
                return (
                  <TouchableOpacity
                    key={beast.id}
                    style={[styles.cropPill, isSelected ? styles.livestockPillActive : null]}
                    onPress={() => handleToggleProduceItem(beast.id)}
                  >
                    <Text style={[styles.cropPillText, isSelected ? styles.cropPillTextActive : null]}>
                      {isSelected ? `✓ ${beast.label}` : beast.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Tab Content: Type Custom tags (comma separated) */}
          {produceCategory === 'CUSTOM' && (
            <View style={styles.customAddBox}>
              <Text style={styles.customInputPrompt}>
                Type custom produce or livestock (e.g. "Ginger, Cashew, Turkey"):
              </Text>
              <View style={styles.customInputRow}>
                <TextInput
                  style={styles.customTextInput}
                  value={customProduceInput}
                  onChangeText={setCustomProduceInput}
                  placeholder="Enter produce/livestock name..."
                  placeholderTextColor="#888"
                  onSubmitEditing={handleAddCustomProduce}
                />
                <TouchableOpacity style={styles.customAddButton} onPress={handleAddCustomProduce}>
                  <Text style={styles.customAddButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {errors.crop_type && <Text style={styles.errorText}>{errors.crop_type}</Text>}
        </View>

        <View style={isCompact ? styles.columnLayout : styles.rowLayout}>
          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfLeft]}>
            <Text style={styles.label}>Farm Size (Hectares) *</Text>
            <TextInput
              style={[styles.input, errors.farm_size_hectares ? styles.inputError : null]}
              value={farmSizeHectares}
              onChangeText={(text) => {
                setFarmSizeHectares(text);
                if (errors.farm_size_hectares) setErrors((prev) => ({ ...prev, farm_size_hectares: undefined }));
              }}
              placeholder="e.g. 4.5"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
            />
            {errors.farm_size_hectares && (
              <Text style={styles.errorText}>{errors.farm_size_hectares}</Text>
            )}
          </View>

          <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfRight]}>
            <Text style={styles.label}>Estimated Yield (Tonnes) *</Text>
            <TextInput
              style={[styles.input, errors.estimated_yield_tonnes ? styles.inputError : null]}
              value={estimatedYieldTonnes}
              onChangeText={(text) => {
                setEstimatedYieldTonnes(text);
                if (errors.estimated_yield_tonnes)
                  setErrors((prev) => ({ ...prev, estimated_yield_tonnes: undefined }));
              }}
              placeholder="e.g. 15.0"
              placeholderTextColor="#888"
              keyboardType="decimal-pad"
            />
            {errors.estimated_yield_tonnes && (
              <Text style={styles.errorText}>{errors.estimated_yield_tonnes}</Text>
            )}
          </View>
        </View>
      </View>

      {/* 5. DUAL-MODE GEOLOCATION (TOWN HALL CENTROID VS LIVE GPS VS MANUAL OVERRIDE) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardHeader, { marginBottom: 0, flexShrink: 1 }]}>
            5. Geo-Anchor & Farm Location
          </Text>
          <Text style={styles.geoModeIndicatorBadge}>
            {locationMode === 'TOWN_HALL' && '🏛️ Town Hall Centroid'}
            {locationMode === 'LIVE_GPS' && '📍 Live GPS Sensor'}
            {locationMode === 'MANUAL_COORDINATES' && '✍ Manual Override'}
          </Text>
        </View>

        {/* Segmented Location Mode Switcher */}
        <View style={styles.locationModeTabBar}>
          <TouchableOpacity
            style={[styles.locationModeTab, locationMode === 'TOWN_HALL' ? styles.locationModeTabActiveA : null]}
            onPress={() => handleLocationModeChange('TOWN_HALL')}
          >
            <Text
              style={[
                styles.locationModeTabText,
                locationMode === 'TOWN_HALL' ? styles.locationModeTabTextActive : null,
              ]}
              numberOfLines={1}
            >
              🏛️ Town Hall Centroid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.locationModeTab, locationMode === 'LIVE_GPS' ? styles.locationModeTabActiveB : null]}
            onPress={() => handleLocationModeChange('LIVE_GPS')}
          >
            <Text
              style={[
                styles.locationModeTabText,
                locationMode === 'LIVE_GPS' ? styles.locationModeTabTextActive : null,
              ]}
              numberOfLines={1}
            >
              📍 Live GPS Fix
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.locationModeTab,
              locationMode === 'MANUAL_COORDINATES' ? styles.locationModeTabActiveC : null,
            ]}
            onPress={() => handleLocationModeChange('MANUAL_COORDINATES')}
          >
            <Text
              style={[
                styles.locationModeTabText,
                locationMode === 'MANUAL_COORDINATES' ? styles.locationModeTabTextActive : null,
              ]}
              numberOfLines={1}
            >
              ✍ Coordinates
            </Text>
          </TouchableOpacity>
        </View>

        {/* MODE A: TOWN HALL / CLUSTER CENTROID (DEFAULT FOR MASS ONBOARDING) */}
        {locationMode === 'TOWN_HALL' && (
          <View style={styles.townHallContainer}>
            <View style={styles.townHallNoticeBox}>
              <Text style={styles.townHallNoticeTitle}>
                🏛️ Centralized Onboarding Mode (200+ Farmers)
              </Text>
              <Text style={styles.townHallNoticeText}>
                Prevents all farmers from clustering at the town-hall/venue coordinates. Select the farmer's Agricultural LGA and Ward to automatically anchor to verified farmland centroid GPS.
              </Text>
            </View>

            {/* Benue LGA Selector */}
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.clusterSubLabel}>Select Benue LGA Hub:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
                <View style={styles.clusterChipRow}>
                  {benueLGAs.map((lgaItem) => {
                    const isSelected = selectedClusterLGA === lgaItem;
                    return (
                      <TouchableOpacity
                        key={lgaItem}
                        style={[styles.lgaChip, isSelected ? styles.lgaChipActive : null]}
                        onPress={() => handleSelectClusterLGA(lgaItem)}
                      >
                        <Text style={[styles.lgaChipText, isSelected ? styles.lgaChipTextActive : null]}>
                          {isSelected ? `✓ ${lgaItem}` : lgaItem}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Agricultural Ward / Community Cluster Selector */}
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.clusterSubLabel}>Select Agricultural Ward / Farming Community:</Text>
              <View style={styles.clusterWardWrap}>
                {currentWards.map((w) => {
                  const isSelected = selectedClusterWard === w.ward_community;
                  return (
                    <TouchableOpacity
                      key={w.ward_community}
                      style={[styles.wardChip, isSelected ? styles.wardChipActive : null]}
                      onPress={() => handleSelectClusterWard(w.ward_community)}
                    >
                      <Text style={[styles.wardChipText, isSelected ? styles.wardChipTextActive : null]}>
                        {isSelected ? `✓ ${w.ward_community}` : w.ward_community}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Verified Centroid Coordinates Badge Card */}
            {selectedClusterInfo && (
              <View style={styles.centroidCard}>
                <View style={styles.centroidCardHeader}>
                  <Text style={styles.centroidCardTitle}>📍 Verified Cluster Centroid</Text>
                  <Text style={styles.centroidStatusBadge}>✓ Pre-loaded Offline</Text>
                </View>
                <Text style={styles.centroidDescriptionText}>{selectedClusterInfo.description}</Text>
                <View style={styles.centroidCoordsRow}>
                  <Text style={styles.centroidCoordVal}>
                    Lat: <Text style={{ fontWeight: '900', color: '#0F172A' }}>{latitude}° N</Text>
                  </Text>
                  <Text style={styles.centroidCoordVal}>
                    Lng: <Text style={{ fontWeight: '900', color: '#0F172A' }}>{longitude}° E</Text>
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* MODE B: ON-FARM LIVE GPS (PHYSICAL FARM-GATE ENUMERATION) */}
        {locationMode === 'LIVE_GPS' && (
          <View style={styles.liveGpsContainer}>
            <View style={styles.liveGpsHeaderRow}>
              <Text style={styles.liveGpsPrompt}>Live Hardware GPS Sensor:</Text>
              <TouchableOpacity
                style={styles.gpsRefreshButton}
                onPress={fetchGpsLocation}
                disabled={isLoadingGps}
              >
                {isLoadingGps ? (
                  <ActivityIndicator size="small" color="#0052CC" />
                ) : (
                  <Text style={styles.gpsRefreshButtonText}>📍 Refresh GPS</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.gpsStatusContainer}>
              <View style={styles.gpsMetricBlock}>
                <Text style={styles.gpsLabel}>Latitude</Text>
                <Text style={styles.gpsValue} numberOfLines={1}>
                  {latitude !== null ? `${latitude}°` : 'Fixing...'}
                </Text>
              </View>
              <View style={styles.gpsMetricBlock}>
                <Text style={styles.gpsLabel}>Longitude</Text>
                <Text style={styles.gpsValue} numberOfLines={1}>
                  {longitude !== null ? `${longitude}°` : 'Fixing...'}
                </Text>
              </View>
              <View style={styles.gpsMetricBlock}>
                <Text style={styles.gpsLabel}>Accuracy</Text>
                <Text style={[styles.gpsValue, { color: '#0A7B3E' }]} numberOfLines={1}>
                  {gpsAccuracy !== null ? `±${gpsAccuracy}m` : '--'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* MODE C: MANUAL COORDINATES OVERRIDE */}
        {locationMode === 'MANUAL_COORDINATES' && (
          <View style={styles.manualCoordsContainer}>
            <Text style={styles.manualCoordsPrompt}>
              Enter precise numeric GPS coordinates (e.g. from handheld survey receiver):
            </Text>
            <View style={isCompact ? styles.columnLayout : styles.rowLayout}>
              <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfLeft]}>
                <Text style={styles.label}>Latitude (-90 to 90) *</Text>
                <TextInput
                  style={[styles.input, errors.latitude ? styles.inputError : null]}
                  value={manualLatStr}
                  onChangeText={handleManualLatChange}
                  placeholder="e.g. 7.35412"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.fieldGroup, isCompact ? styles.fieldGroupFull : styles.fieldGroupHalfRight]}>
                <Text style={styles.label}>Longitude (-180 to 180) *</Text>
                <TextInput
                  style={[styles.input, errors.longitude ? styles.inputError : null]}
                  value={manualLngStr}
                  onChangeText={handleManualLngChange}
                  placeholder="e.g. 9.04321"
                  placeholderTextColor="#888"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        )}

        {errors.latitude && <Text style={styles.errorText}>{errors.latitude}</Text>}
        {errors.longitude && <Text style={styles.errorText}>{errors.longitude}</Text>}

        {/* Physical Farm Landmark / Address Description (Applicable to all modes) */}
        <View style={[styles.fieldGroup, { marginTop: 12, marginBottom: 0 }]}>
          <View style={styles.labelWithHint}>
            <Text style={[styles.label, { flexShrink: 1 }]}>Physical Farm Landmark / Address Description</Text>
            <Text style={styles.hintBadge}>Landmark Notes</Text>
          </View>
          <TextInput
            style={styles.input}
            value={farmLocation}
            onChangeText={setFarmLocation}
            placeholder="e.g. 1.5km off Gboko-Aliade road behind St. John's Primary School"
            placeholderTextColor="#888"
          />
          <Text style={styles.locationHelpText}>
            ℹ️ Detail the exact farmland landmark, boundary, or road reference for physical verification by field supervisors.
          </Text>
        </View>
      </View>

      {/* 6. BIOMETRIC FINGERPRINT SCANNER (ESP32) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardHeader, { marginBottom: 0, flexShrink: 1 }]}>6. ESP32 Biometrics</Text>
          <View style={styles.mockToggleContainer}>
            <Text style={[styles.mockToggleLabel, { color: pairedScanner ? '#059669' : '#64748B', fontWeight: '800' }]}>
              {pairedScanner ? `🟢 ${pairedScanner.name}` : '⚪ ESP32 Disconnected'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.bioScanButton, isScanningBio ? styles.bioScanButtonScanning : null]}
          onPress={handleScanBiometrics}
          disabled={isScanningBio}
        >
          {isScanningBio ? (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.bioScanButtonText}> Place Finger on Scanner...</Text>
            </View>
          ) : (
            <Text style={styles.bioScanButtonText}>
              {biometricHash ? '✓ Re-Scan Fingerprint (ESP32)' : '👆 Capture Fingerprint (ESP32)'}
            </Text>
          )}
        </TouchableOpacity>

        {biometricHash ? (
          <View style={styles.bioHashBox}>
            <View style={styles.bioHashHeader}>
              <Text style={styles.bioHashTitle}>SHA-256 Template Hash</Text>
              {bioQualityScore !== null && (
                <Text style={styles.bioQualityBadge}>Quality: {bioQualityScore}%</Text>
              )}
            </View>
            <Text style={styles.bioHashText}>
              {biometricHash}
            </Text>
          </View>
        ) : (
          <Text style={styles.bioPromptText}>
            {pairedScanner
              ? 'Tap Capture Fingerprint and place the farmer’s finger on the ESP32 optical sensor glass.'
              : 'Please pair an ESP32 Bluetooth scanner in the Bluetooth tab to capture biometric templates.'}
          </Text>
        )}
        {errors.biometric_template_hash && (
          <Text style={styles.errorText}>{errors.biometric_template_hash}</Text>
        )}
      </View>

      {/* 7. SAVE BUTTON */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>💾 Save Farmer Record to SQLite</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerHighContrast: {
    backgroundColor: '#F0F4F8',
  },
  containerNormal: {
    backgroundColor: '#FAFAFA',
  },
  contentContainer: {
    padding: 12,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  headerBadge: {
    backgroundColor: '#1E3A8A',
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  contrastToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contrastToggleLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  deviceHeaderBadge: {
    marginTop: 8,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deviceHeaderText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  quickActionsColumn: {
    flexDirection: 'column',
  },
  sampleDataButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#1D4ED8',
  },
  sampleDataButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  resetButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  successBanner: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  successBannerTitle: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  successBannerText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
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
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  geoModeIndicatorBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  locationModeTabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  locationModeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationModeTabActiveA: {
    backgroundColor: '#1E40AF',
  },
  locationModeTabActiveB: {
    backgroundColor: '#0F766E',
  },
  locationModeTabActiveC: {
    backgroundColor: '#475569',
  },
  locationModeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  locationModeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  townHallContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  townHallNoticeBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 10,
  },
  townHallNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 2,
  },
  townHallNoticeText: {
    fontSize: 10,
    color: '#78350F',
    lineHeight: 14,
  },
  clusterSubLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 5,
  },
  chipScrollView: {
    flexDirection: 'row',
  },
  clusterChipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  lgaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  lgaChipActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E3A8A',
  },
  lgaChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  lgaChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  clusterWardWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wardChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  wardChipActive: {
    backgroundColor: '#059669',
    borderColor: '#047857',
  },
  wardChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  wardChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  centroidCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    marginTop: 4,
  },
  centroidCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  centroidCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  centroidStatusBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  centroidDescriptionText: {
    fontSize: 11,
    color: '#1E3A8A',
    fontWeight: '600',
    marginBottom: 6,
  },
  centroidCoordsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  centroidCoordVal: {
    fontSize: 11,
    color: '#475569',
  },
  liveGpsContainer: {
    marginBottom: 8,
  },
  liveGpsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  liveGpsPrompt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  manualCoordsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  manualCoordsPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldGroupFull: {
    width: '100%',
  },
  fieldGroupHalfLeft: {
    flex: 1,
    marginRight: 6,
  },
  fieldGroupHalfRight: {
    flex: 1,
    marginLeft: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 5,
  },
  labelWithHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    flexWrap: 'wrap',
    gap: 4,
  },
  hintBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lockedBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  lockedSubBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedCountBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  input: {
    minHeight: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#64748B',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  lockedInput: {
    backgroundColor: '#E2E8F0',
    borderColor: '#94A3B8',
    color: '#334155',
    fontWeight: '700',
  },
  detectedHardwareRow: {
    marginTop: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  detectedHardwareLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  detectedHardwareValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  selectedChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    minHeight: 44,
    marginBottom: 8,
  },
  noProduceSelectedText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    alignSelf: 'center',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingLeft: 8,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 4,
    maxWidth: '100%',
  },
  selectedChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 1,
  },
  chipRemoveBtn: {
    backgroundColor: '#334155',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipRemoveBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  categoryTabBar: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
    gap: 4,
  },
  catTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catTabActive: {
    backgroundColor: '#0F172A',
  },
  catTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  cropPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  cropPillActive: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E3A8A',
  },
  livestockPillActive: {
    backgroundColor: '#0F766E',
    borderColor: '#115E59',
  },
  cropPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  cropPillTextActive: {
    color: '#FFFFFF',
  },
  customAddBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 4,
  },
  customInputPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  customTextInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  customAddButton: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAddButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  gpsRefreshButton: {
    backgroundColor: '#DBEAFE',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  gpsRefreshButtonText: {
    color: '#1E40AF',
    fontSize: 11,
    fontWeight: '800',
  },
  gpsStatusContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  gpsMetricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  gpsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  gpsValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  mockToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mockToggleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  bioScanButton: {
    minHeight: 48,
    backgroundColor: '#0F766E',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#115E59',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  bioScanButtonScanning: {
    backgroundColor: '#D97706',
    borderColor: '#B45309',
  },
  bioScanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioPromptText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bioHashBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#5EEAD4',
    borderRadius: 8,
    padding: 10,
  },
  bioHashHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  bioHashTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  bioQualityBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bioHashText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: '#134E4A',
    flexWrap: 'wrap',
  },
  submitButton: {
    minHeight: 54,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#14532D',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    borderColor: '#6B7280',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  locationHelpText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 15,
  },
});
