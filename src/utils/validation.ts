import { FarmerInput } from '../types';

export interface ValidationErrors {
  agent_id?: string;
  device_uuid?: string;
  farmer_name?: string;
  nin?: string;
  bvn?: string;
  phone_number?: string;
  lga?: string;
  community_ward?: string;
  cooperative_name?: string;
  crop_type?: string;
  farm_size_hectares?: string;
  estimated_yield_tonnes?: string;
  latitude?: string;
  longitude?: string;
  biometric_template_hash?: string;
  general?: string;
}

/**
 * Validates National Identification Number (NIN).
 * Strict rule: Must be exactly 11 digits and preserved as text string (leading zeros allowed).
 */
export function validateNIN(nin: string): string | null {
  if (!nin || nin.trim().length === 0) {
    return 'NIN is required.';
  }
  const clean = nin.trim();
  if (!/^\d{11}$/.test(clean)) {
    return 'NIN must be exactly 11 digits (e.g. 01234567890).';
  }
  return null;
}

/**
 * Validates Bank Verification Number (BVN).
 * Strict rule: Must be exactly 11 digits and preserved as text string (leading zeros allowed).
 */
export function validateBVN(bvn: string): string | null {
  if (!bvn || bvn.trim().length === 0) {
    return 'BVN is required.';
  }
  const clean = bvn.trim();
  if (!/^\d{11}$/.test(clean)) {
    return 'BVN must be exactly 11 digits (e.g. 09876543210).';
  }
  return null;
}

/**
 * Validates phone numbers (standard format, 10 to 14 characters including optional '+').
 */
export function validatePhoneNumber(phone: string): string | null {
  if (!phone || phone.trim().length === 0) {
    return 'Phone number is required.';
  }
  const clean = phone.trim();
  if (!/^\+?[0-9]{10,14}$/.test(clean.replace(/[\s-]/g, ''))) {
    return 'Phone number must be a valid 10-14 digit number (e.g. 08012345678).';
  }
  return null;
}

/**
 * Validates biometric template hash (64-character hex string).
 */
export function validateBiometricHash(hash: string): string | null {
  if (!hash || hash.trim().length === 0) {
    return 'Biometric fingerprint scan is required.';
  }
  const clean = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(clean)) {
    return 'Biometric template must be a valid 64-character SHA-256 hash.';
  }
  return null;
}

/**
 * Validates complete 18-column farmer demographic input.
 */
export function validateFarmerInput(data: Partial<FarmerInput>): {
  isValid: boolean;
  errors: ValidationErrors;
} {
  const errors: ValidationErrors = {};

  if (!data.agent_id?.trim()) {
    errors.agent_id = 'Agent ID is required.';
  }

  if (!data.device_uuid?.trim()) {
    errors.device_uuid = 'Device UUID is required.';
  }

  if (!data.farmer_name?.trim()) {
    errors.farmer_name = 'Farmer full name is required.';
  } else if (data.farmer_name.trim().length < 2) {
    errors.farmer_name = 'Farmer name must be at least 2 characters.';
  }

  const ninErr = validateNIN(data.nin || '');
  if (ninErr) errors.nin = ninErr;

  const bvnErr = validateBVN(data.bvn || '');
  if (bvnErr) errors.bvn = bvnErr;

  const phoneErr = validatePhoneNumber(data.phone_number || '');
  if (phoneErr) errors.phone_number = phoneErr;

  if (!data.lga?.trim()) {
    errors.lga = 'LGA (Local Government Area) is required.';
  }

  if (!data.community_ward?.trim()) {
    errors.community_ward = 'Community / Ward is required.';
  }

  if (!data.cooperative_name?.trim()) {
    errors.cooperative_name = 'Cooperative name is required.';
  }

  if (!data.crop_type?.trim()) {
    errors.crop_type = 'At least one primary farm produce or livestock option is required.';
  }

  if (data.farm_size_hectares === undefined || isNaN(data.farm_size_hectares) || data.farm_size_hectares <= 0) {
    errors.farm_size_hectares = 'Farm size must be a positive number in hectares.';
  }

  if (
    data.estimated_yield_tonnes === undefined ||
    isNaN(data.estimated_yield_tonnes) ||
    data.estimated_yield_tonnes <= 0
  ) {
    errors.estimated_yield_tonnes = 'Estimated yield must be a positive number in tonnes.';
  }

  if (
    data.latitude === undefined ||
    isNaN(data.latitude) ||
    data.latitude < -90 ||
    data.latitude > 90 ||
    data.latitude === 0
  ) {
    errors.latitude = 'Valid GPS Latitude is required (-90 to 90).';
  }

  if (
    data.longitude === undefined ||
    isNaN(data.longitude) ||
    data.longitude < -180 ||
    data.longitude > 180 ||
    data.longitude === 0
  ) {
    errors.longitude = 'Valid GPS Longitude is required (-180 to 180).';
  }

  const bioErr = validateBiometricHash(data.biometric_template_hash || '');
  if (bioErr) errors.biometric_template_hash = bioErr;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
