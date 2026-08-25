export interface FarmerRecordOut {
  id: number;
  record_uuid?: string | null;
  agent_id?: string | null;
  device_uuid?: string | null;
  farmer_name?: string | null;
  full_legal_name?: string | null;
  nin: string; // Strict 11-digit text preserving leading zeros
  bvn: string; // Strict 11-digit text preserving leading zeros
  phone_number?: string | null;
  primary_phone?: string | null;
  mothers_maiden_name?: string | null;
  next_of_kin?: string | null;
  state?: string | null;
  lga: string;
  ward?: string | null;
  community_ward?: string | null;
  community_village?: string | null;
  cooperative_name?: string | null;
  crop_type?: string | null;
  value_chain_type?: string | null;
  farm_size_hectares?: number | null;
  farm_size_volume?: string | null;
  estimated_yield_tonnes?: number | null;
  specific_production_detail?: string | null;
  farm_location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gps_coordinates?: string | null;
  biometric_template_hash?: string | null;
  fingerprint_hash?: string | null;
  captured_at?: string | null;
  created_at?: string | null;
  is_locked: boolean;
  audit_checksum?: string | null;
}

export interface PaginatedRecordsResponse {
  total_count: number;
  limit: number;
  offset: number;
  records: FarmerRecordOut[];
}

export interface StatsSummaryResponse {
  total_registered_farmers: number;
  sec_digital_locked_records: number;
  total_farm_area_hectares: number;
  total_estimated_yield_tonnes: number;
  active_field_agents: number;
  database_status: string;
  last_updated: string;
}

export interface SystemHealth {
  status: string;
  service: string;
  endpoints: Record<string, string>;
  latencyMs?: number;
}

export interface TransitReconciliationRequest {
  batch_ticket_id: string;
  soft_id_token: string;
  enumerator_id: string;
  mass_field: number;
  mass_store: number;
  weighbridge_operator_id: string;
}

export interface TransitReconciliationResponse {
  status: string;
  mass_variance: number;
  is_flagged: boolean;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  audit_checksum: string;
  details?: string;
  incident_details?: string;
  regulatory_context?: string;
}

export interface FarmerFilters {
  search?: string;
  lga?: string;
  crop_type?: string;
  agent_id?: string;
  is_locked?: boolean;
  limit?: number;
  offset?: number;
}

export interface BenueCluster {
  lga: string;
  ward_community: string;
  default_crop: string;
  centroid_latitude: number;
  centroid_longitude: number;
  description: string;
}
