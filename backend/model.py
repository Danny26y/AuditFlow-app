from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class FarmerRegistry(Base):
    __tablename__ = 'farmer_registry'

    id = Column(Integer, primary_key=True, autoincrement=True)
    record_uuid = Column(String(36), unique=True, index=True, nullable=True) # UUID v4 from client
    serial_number = Column(Integer, nullable=True)
    agent_id = Column(String(50), nullable=True) # Field agent identifier
    enumerator_id = Column(String(50), nullable=True)
    device_uuid = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    captured_at = Column(DateTime, nullable=True)

    # 18-Column Onboarding Demographics
    registration_tier = Column(String(20), default="Tier 1", nullable=True)
    farmer_name = Column(String(255), nullable=True) # Full legal name
    full_legal_name = Column(String(255), nullable=True)
    
    # Strict 11-digit text strings (leading zeros preserved)
    nin = Column(String(11), nullable=False, unique=True, index=True)
    bvn = Column(String(11), nullable=False, unique=True, index=True)
    
    phone_number = Column(String(15), nullable=True)
    primary_phone = Column(String(15), nullable=True)
    mothers_maiden_name = Column(String(150), nullable=True)
    next_of_kin = Column(Text, nullable=True)

    # Geographic Context
    state = Column(String(50), default="Benue")
    lga = Column(String(100), nullable=False)
    ward = Column(String(100), nullable=True)
    community_ward = Column(String(100), nullable=True)
    community_village = Column(String(255), nullable=True)
    cooperative_name = Column(String(255), nullable=True)

    # Asset & Agricultural Production Metrics
    crop_type = Column(String(255), nullable=True)
    value_chain_type = Column(String(50), nullable=True)
    geospatial_format = Column(String(20), default="Point")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    gps_coordinates = Column(Text, nullable=True)
    farm_size_hectares = Column(Float, nullable=True)
    farm_size_volume = Column(String(100), nullable=True)
    farm_location = Column(Text, nullable=True) # Physical farm location / landmark / manual coordinates
    estimated_yield_tonnes = Column(Float, nullable=True)
    specific_production_detail = Column(String(255), nullable=True)

    # SEC Security & Biometrics
    is_locked = Column(Boolean, default=True) # SEC digital lock active upon ingestion
    audit_checksum = Column(String(100), nullable=True)
    biometric_template_hash = Column(String(64), nullable=True, unique=True, index=True) # SHA-256 fingerprint hash
    fingerprint_hash = Column(Text, nullable=True)
    image_metadata_gps = Column(Text, nullable=True)