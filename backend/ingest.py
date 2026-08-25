import io
import csv
from datetime import datetime, timezone
from typing import List, Optional
import pandas as pd
from pydantic import BaseModel, Field, field_validator
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi.responses import JSONResponse, StreamingResponse

from model import FarmerRegistry, Base
from security_engine import SystemAuditTrailLog
from database import get_db

# Router handles both /api/v1/ingest and /api/v1/ingestion paths
router = APIRouter(prefix="/api/v1/ingest", tags=["Data Ingestion & Master Registry"])
legacy_router = APIRouter(prefix="/api/v1/ingestion", tags=["Data Ingestion (Legacy)"])


# ----------------------------------------------------
# Pydantic Schemas for Ingestion & Record Retrieval
# ----------------------------------------------------
class FarmerIngestRecord(BaseModel):
    id: str = Field(..., description="UUID v4 from mobile client")
    agent_id: str = Field(..., description="Field agent ID")
    device_uuid: str = Field(..., description="Device UUID")
    farmer_name: str = Field(..., min_length=2, description="Farmer full name")
    nin: str = Field(..., min_length=11, max_length=11, description="Strict 11-digit string")
    bvn: str = Field(..., min_length=11, max_length=11, description="Strict 11-digit string")
    phone_number: str = Field(..., description="Phone number")
    lga: str = Field(..., description="Local Government Area")
    community_ward: str = Field(..., description="Community or Ward")
    cooperative_name: str = Field(..., description="Cooperative name")
    crop_type: str = Field(..., description="Primary produce or livestock")
    farm_size_hectares: float = Field(..., gt=0, description="Farm size in hectares")
    estimated_yield_tonnes: float = Field(..., gt=0, description="Estimated yield in tonnes")
    farm_location: Optional[str] = Field(None, description="Physical farm location / landmark / manual coordinates")
    latitude: float = Field(..., ge=-90, le=90, description="GPS Latitude")
    longitude: float = Field(..., ge=-180, le=180, description="GPS Longitude")
    biometric_template_hash: str = Field(..., min_length=64, max_length=64, description="64-char SHA-256 biometric hash")
    captured_at: str = Field(..., description="ISO-8601 UTC timestamp")
    sync_status: Optional[str] = "PENDING_SYNC"
    sync_error_message: Optional[str] = None

    @field_validator("nin", "bvn")
    @classmethod
    def validate_11_digits(cls, v: str) -> str:
        clean = str(v).strip()
        if len(clean) != 11 or not clean.isdigit():
            raise ValueError("Must be exactly 11 numeric digits with leading zeros preserved.")
        return clean

    @field_validator("biometric_template_hash")
    @classmethod
    def validate_hex_hash(cls, v: str) -> str:
        clean = str(v).strip().lower()
        if len(clean) != 64 or not all(c in "0123456789abcdef" for c in clean):
            raise ValueError("Biometric hash must be a 64-character hexadecimal SHA-256 string.")
        return clean


class SyncBatchRequest(BaseModel):
    batch_id: str = Field(..., description="Batch UUID v4 identifier")
    agent_id: str = Field(..., description="Field Agent Anchor ID")
    timestamp: str = Field(..., description="Batch creation timestamp")
    batch_size: int = Field(..., description="Record count in this chunk")
    records: List[FarmerIngestRecord] = Field(..., description="List of farmer records (up to 10-20 per chunk)")


class SyncBatchItemResult(BaseModel):
    id: str
    status: str # SUCCESS or ERROR
    error_message: Optional[str] = None


class SyncBatchResponse(BaseModel):
    batch_id: str
    status: str # SUCCESS, PARTIAL, or FAILED
    processed_count: int
    success_count: int
    error_count: int
    synced_ids: List[str]
    results: List[SyncBatchItemResult]
    message: str
    audit_checksum: Optional[str] = None


class FarmerRecordOut(BaseModel):
    id: int
    record_uuid: Optional[str] = None
    agent_id: Optional[str] = None
    device_uuid: Optional[str] = None
    farmer_name: Optional[str] = None
    nin: str
    bvn: str
    phone_number: Optional[str] = None
    lga: str
    community_ward: Optional[str] = None
    cooperative_name: Optional[str] = None
    crop_type: Optional[str] = None
    farm_size_hectares: Optional[float] = None
    estimated_yield_tonnes: Optional[float] = None
    farm_location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    biometric_template_hash: Optional[str] = None
    captured_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    is_locked: bool
    audit_checksum: Optional[str] = None

    class Config:
        from_attributes = True


class PaginatedRecordsResponse(BaseModel):
    total_count: int
    limit: int
    offset: int
    records: List[FarmerRecordOut]


# ----------------------------------------------------
# Core Batch Ingestion Endpoint: POST /api/v1/ingest/batch
# ----------------------------------------------------
@router.post("/batch", response_model=SyncBatchResponse, status_code=status.HTTP_200_OK)
async def ingest_chunked_batch(payload: SyncBatchRequest, db: Session = Depends(get_db)):
    """
    Ingests chunked batches of farmer records (10 records/batch).
    Enforces strict 11-digit text preservation for NIN & BVN.
    Applies deduplication on NIN, BVN, and biometric hashes.
    Activates SEC Digital Lock (is_locked=True) and generates immutable audit trail.
    """
    try:
        results: List[SyncBatchItemResult] = []
        synced_ids: List[str] = []
        db_records_to_insert: List[FarmerRegistry] = []

        seen_batch_nins = set()
        seen_batch_bvns = set()
        seen_batch_bios = set()

        for rec in payload.records:
            # 1. Intra-batch duplicate check
            if rec.nin in seen_batch_nins:
                results.append(SyncBatchItemResult(
                    id=rec.id,
                    status="ERROR",
                    error_message=f"Duplicate NIN '{rec.nin}' within same batch payload."
                ))
                continue
            if rec.bvn in seen_batch_bvns:
                results.append(SyncBatchItemResult(
                    id=rec.id,
                    status="ERROR",
                    error_message=f"Duplicate BVN '{rec.bvn}' within same batch payload."
                ))
                continue
            if rec.biometric_template_hash in seen_batch_bios:
                results.append(SyncBatchItemResult(
                    id=rec.id,
                    status="ERROR",
                    error_message=f"Duplicate biometric template hash within same batch payload."
                ))
                continue

            # 2. Database duplicate check
            existing_nin = db.query(FarmerRegistry).filter(FarmerRegistry.nin == rec.nin).first()
            if existing_nin:
                results.append(SyncBatchItemResult(
                    id=rec.id,
                    status="ERROR",
                    error_message=f"Farmer with NIN '{rec.nin}' is already registered in registry."
                ))
                continue

            existing_bvn = db.query(FarmerRegistry).filter(FarmerRegistry.bvn == rec.bvn).first()
            if existing_bvn:
                results.append(SyncBatchItemResult(
                    id=rec.id,
                    status="ERROR",
                    error_message=f"Farmer with BVN '{rec.bvn}' is already registered in registry."
                ))
                continue

            existing_bio = db.query(FarmerRegistry).filter(FarmerRegistry.biometric_template_hash == rec.biometric_template_hash).first()
            if existing_bio:
                results.append(SyncBatchItemResult(
                    id=rec.id,
                    status="ERROR",
                    error_message=f"Biometric hash already registered to farmer '{existing_bio.farmer_name or existing_bio.full_legal_name}'."
                ))
                continue

            seen_batch_nins.add(rec.nin)
            seen_batch_bvns.add(rec.bvn)
            seen_batch_bios.add(rec.biometric_template_hash)

            # 3. Parse captured_at ISO datetime
            try:
                dt_captured = datetime.fromisoformat(rec.captured_at.replace("Z", "+00:00"))
            except Exception:
                dt_captured = datetime.now(timezone.utc)

            # 4. Construct DB model with SEC Digital Lock
            farmer_entity = FarmerRegistry(
                record_uuid=rec.id,
                agent_id=rec.agent_id,
                enumerator_id=rec.agent_id,
                device_uuid=rec.device_uuid,
                farmer_name=rec.farmer_name,
                full_legal_name=rec.farmer_name,
                nin=rec.nin, # Strict 11-digit text preserved
                bvn=rec.bvn, # Strict 11-digit text preserved
                phone_number=rec.phone_number,
                primary_phone=rec.phone_number,
                lga=rec.lga,
                community_ward=rec.community_ward,
                ward=rec.community_ward,
                cooperative_name=rec.cooperative_name,
                crop_type=rec.crop_type,
                value_chain_type=rec.crop_type,
                farm_size_hectares=rec.farm_size_hectares,
                farm_size_volume=f"{rec.farm_size_hectares} ha",
                farm_location=rec.farm_location,
                estimated_yield_tonnes=rec.estimated_yield_tonnes,
                latitude=rec.latitude,
                longitude=rec.longitude,
                gps_coordinates=f"{rec.latitude}, {rec.longitude}",
                biometric_template_hash=rec.biometric_template_hash,
                fingerprint_hash=rec.biometric_template_hash,
                captured_at=dt_captured,
                is_locked=True, # SEC Digital Lock activated upon ingestion
            )
            db_records_to_insert.append(farmer_entity)
            synced_ids.append(rec.id)
            results.append(SyncBatchItemResult(id=rec.id, status="SUCCESS"))

        # 5. Persist to master database
        if len(db_records_to_insert) > 0:
            db.bulk_save_objects(db_records_to_insert)
            db.commit()

        # 6. Generate SEC Cryptographic Audit Trail Log
        audit_log = SystemAuditTrailLog(
            batch_id=payload.batch_id,
            delta_m=0.0,
            severity="INFO",
            message=f"Batch {payload.batch_id} ingested: {len(synced_ids)} records locked and certified under SEC ISA standards."
        )

        success_count = len(synced_ids)
        error_count = len(results) - success_count
        overall_status = "SUCCESS" if error_count == 0 else ("PARTIAL" if success_count > 0 else "FAILED")

        return SyncBatchResponse(
            batch_id=payload.batch_id,
            status=overall_status,
            processed_count=len(payload.records),
            success_count=success_count,
            error_count=error_count,
            synced_ids=synced_ids,
            results=results,
            message=f"Batch {payload.batch_id} processed. {success_count} record(s) SEC-locked and synchronized.",
            audit_checksum=audit_log.log_id,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch ingestion fatal crash: {str(e)}"
        )


# ----------------------------------------------------
# Query & Retrieval Endpoints for Server-Side Use
# ----------------------------------------------------
@router.get("/records", response_model=PaginatedRecordsResponse)
async def list_registered_farmers(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search by name, NIN, BVN, LGA"),
    lga: Optional[str] = None,
    crop_type: Optional[str] = None,
    agent_id: Optional[str] = None,
    is_locked: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """
    Pulls paginated and filtered farmer demographic records from the central server database.
    Supports downstream analytics, field monitoring, and audit verification.
    """
    query = db.query(FarmerRegistry)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                FarmerRegistry.farmer_name.ilike(s),
                FarmerRegistry.full_legal_name.ilike(s),
                FarmerRegistry.nin.like(s),
                FarmerRegistry.bvn.like(s),
                FarmerRegistry.lga.ilike(s),
                FarmerRegistry.crop_type.ilike(s)
            )
        )

    if lga:
        query = query.filter(FarmerRegistry.lga.ilike(f"%{lga.strip()}%"))
    if crop_type:
        query = query.filter(FarmerRegistry.crop_type.ilike(f"%{crop_type.strip()}%"))
    if agent_id:
        query = query.filter(FarmerRegistry.agent_id == agent_id.strip())
    if is_locked is not None:
        query = query.filter(FarmerRegistry.is_locked == is_locked)

    total_count = query.count()
    records = query.order_by(FarmerRegistry.created_at.desc()).offset(offset).limit(limit).all()

    return PaginatedRecordsResponse(
        total_count=total_count,
        limit=limit,
        offset=offset,
        records=records
    )


@router.get("/records/{id_or_nin}", response_model=FarmerRecordOut)
async def get_farmer_record(id_or_nin: str, db: Session = Depends(get_db)):
    """
    Pulls a single complete 18-column farmer demographic record by UUID or 11-digit NIN.
    """
    record = db.query(FarmerRegistry).filter(
        or_(
            FarmerRegistry.record_uuid == id_or_nin,
            FarmerRegistry.nin == id_or_nin,
            FarmerRegistry.bvn == id_or_nin
        )
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Farmer record with identifier '{id_or_nin}' not found in master registry."
        )

    return record


@router.get("/records/export/csv")
async def export_records_csv(db: Session = Depends(get_db)):
    """
    Exports all synchronized master records as a standardized CSV file for auditors and downstream systems.
    """
    records = db.query(FarmerRegistry).order_by(FarmerRegistry.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Write 19-column standardized headers
    writer.writerow([
        "Record UUID", "Agent ID", "Device UUID", "Farmer Name", "NIN (11 Digits)", "BVN (11 Digits)",
        "Phone Number", "LGA", "Ward", "Cooperative Name", "Primary Produce / Livestock",
        "Farm Size (Hectares)", "Estimated Yield (Tonnes)", "Physical Farm Location", "Latitude", "Longitude",
        "Biometric Template Hash", "Captured At (UTC)", "SEC Digital Lock", "Audit Checksum"
    ])

    for r in records:
        writer.writerow([
            r.record_uuid or "",
            r.agent_id or r.enumerator_id or "",
            r.device_uuid or "",
            r.farmer_name or r.full_legal_name or "",
            f"'{r.nin}", # Escape with single quote for Excel leading zero display
            f"'{r.bvn}",
            r.phone_number or r.primary_phone or "",
            r.lga or "",
            r.community_ward or r.ward or "",
            r.cooperative_name or "",
            r.crop_type or r.value_chain_type or "",
            r.farm_size_hectares or "",
            r.estimated_yield_tonnes or "",
            r.farm_location or "",
            r.latitude or "",
            r.longitude or "",
            r.biometric_template_hash or r.fingerprint_hash or "",
            r.captured_at.isoformat() if r.captured_at else "",
            "LOCKED" if r.is_locked else "UNLOCKED",
            r.audit_checksum or ""
        ])

    output.seek(0)
    filename = f"farmer_registry_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/stats/summary")
async def get_master_registry_stats(db: Session = Depends(get_db)):
    """
    Returns aggregate overview metrics from the master database.
    """
    total_count = db.query(func.count(FarmerRegistry.id)).scalar() or 0
    locked_count = db.query(func.count(FarmerRegistry.id)).filter(FarmerRegistry.is_locked == True).scalar() or 0
    total_hectares = db.query(func.sum(FarmerRegistry.farm_size_hectares)).scalar() or 0.0
    total_yield = db.query(func.sum(FarmerRegistry.estimated_yield_tonnes)).scalar() or 0.0
    unique_agents = db.query(func.count(func.distinct(FarmerRegistry.agent_id))).scalar() or 0

    return {
        "total_registered_farmers": total_count,
        "sec_digital_locked_records": locked_count,
        "total_farm_area_hectares": round(float(total_hectares), 2),
        "total_estimated_yield_tonnes": round(float(total_yield), 2),
        "active_field_agents": unique_agents,
        "database_status": "ONLINE_ACTIVE",
        "last_updated": datetime.now(timezone.utc).isoformat()
    }


# ----------------------------------------------------
# Legacy Excel Template Upload Endpoint
# ----------------------------------------------------
@router.post("/upload-template")
@legacy_router.post("/upload-template")
async def upload_excel_template(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File extension not allowed. Must be .xlsx or .xls",
        )
    try:
        contents = await file.read()
        excel_stream = io.BytesIO(contents)

        xls = pd.ExcelFile(excel_stream)
        target_sheet = 'Data Capture Template'
        if target_sheet not in xls.sheet_names:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing mandatory sheet: '{target_sheet}' layout is missing.",
            )
        df = pd.read_excel(xls, sheet_name=target_sheet)
        df.columns = [str(col).replace('\n', '').strip() for col in df.columns]

        expected_columns = [
            'S/N', 'Farmer Registration Tier (Tier 1 / Tier 2)',
            'Full Legal Name (Must match NIN/BVN)',
            'National Identification Number (NIN) (11 Digits - Mandatory)',
            'Bank Verification Number (BVN) (11 Digits - Mandatory)',
            'Primary Phone Number (11 Digits)', "Mother's Maiden Name (Anti-Fraud Link)",
            'Next of Kin / Alt Contact (Full Name + Phone)', 'State', 'LGA', 'Ward',
            'Community / Village', 'Value Chain / Asset Type (Crop / Fishery / Livestock)',
            'Geospatial Format (Polygon / Point)',
            'GPS Coordinates (Lat/Long String or Perimeter Points)',
            'Farm Size / Asset Volume (Hectares / m^2 / Animal Count',
            'Specific Production Detail (e.g. , Catfish, Cattle, Maize)',
            'Enumerator ID (Field Agent Anchor)'
        ]

        for col in expected_columns:
            if col not in df.columns:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Structural column violation! Header missing or renamed: '{col}'."
                )

        operational_df = df.iloc[7:].dropna(subset=["Full Legal Name (Must match NIN/BVN)"])
        if operational_df.empty:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"message": "Template uploaded successfully, but no operational records were found to ingest."}
            )

        records_to_insert = []
        for _, row in operational_df.iterrows():
            raw_nin = str(row['National Identification Number (NIN) (11 Digits - Mandatory)']).split('.')[0].strip()
            clean_nin = raw_nin.zfill(11)
            raw_bvn = str(row['Bank Verification Number (BVN) (11 Digits - Mandatory)']).split('.')[0].strip()
            clean_bvn = raw_bvn.zfill(11)
            clean_phone = str(row['Primary Phone Number (11 Digits)']).split('.')[0].strip()

            if len(clean_nin) != 11 or len(clean_bvn) != 11:
                continue

            farmer_data = FarmerRegistry(
                serial_number=int(row['S/N']) if str(row['S/N']).isdigit() else None,
                registration_tier=str(row['Farmer Registration Tier (Tier 1 / Tier 2)']),
                full_legal_name=str(row['Full Legal Name (Must match NIN/BVN)']),
                farmer_name=str(row['Full Legal Name (Must match NIN/BVN)']),
                nin=clean_nin,
                bvn=clean_bvn,
                primary_phone=clean_phone,
                phone_number=clean_phone,
                mothers_maiden_name=str(row["Mother's Maiden Name (Anti-Fraud Link)"]),
                next_of_kin=str(row['Next of Kin / Alt Contact (Full Name + Phone)']),
                state=str(row['State']),
                lga=str(row['LGA']),
                ward=str(row['Ward']),
                community_ward=str(row['Ward']),
                community_village=str(row['Community / Village']),
                value_chain_type=str(row['Value Chain / Asset Type (Crop / Fishery / Livestock)']),
                crop_type=str(row['Value Chain / Asset Type (Crop / Fishery / Livestock)']),
                geospatial_format=str(row['Geospatial Format (Polygon / Point)']),
                gps_coordinates=str(row['GPS Coordinates (Lat/Long String or Perimeter Points)']),
                farm_size_volume=str(row['Farm Size / Asset Volume (Hectares / m^2 / Animal Count']),
                specific_production_detail=str(row['Specific Production Detail (e.g. , Catfish, Cattle, Maize)']),
                enumerator_id=str(row['Enumerator ID (Field Agent Anchor)']),
                agent_id=str(row['Enumerator ID (Field Agent Anchor)']),
                is_locked=True
            )
            records_to_insert.append(farmer_data)

        if len(records_to_insert) > 0:
            db.bulk_save_objects(records_to_insert)
            db.commit()

        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "status": "Success",
                "message": f"Successfully parsed template. {len(records_to_insert)} unique primary producers prepped for database ingestion.",
                "target_sheet": target_sheet
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion fatal crash: {str(e)}"
        )