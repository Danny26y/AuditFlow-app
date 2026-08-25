from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/v1/security", tags=["Supply Chain Security"])


# 1. Define strict API schemas for the Weighbridge Check-In Payload
class TransitReconciliationRequest(BaseModel):
    batch_ticket_id: str = Field(..., example="BATCH-2026-MKD-089A")
    soft_id_token: str = Field(..., example="SOFT-ID-992384")
    enumerator_id: str = Field(..., example="ENUM-MKD-BRB-01")
    mass_field: float = Field(..., description="Initial weight scanned at farm gate (kg)", gt=0.0)
    mass_store: float = Field(..., description="Final weight scanned at warehouse weighbridge (kg)", gt=0.0)
    weighbridge_operator_id: str = Field(..., example="OP-WHD-04")


# 2. Schema for the Independent Audit Log output
class SystemAuditTrailLog:
    def __init__(self, batch_id, delta_m, severity, message):
        self.log_id = f"LOG-{int(datetime.utcnow().timestamp())}"
        self.timestamp = datetime.utcnow().isoformat()
        self.batch_ticket_id = batch_id
        self.mass_variance = delta_m
        self.severity_level = severity  # INFO, WARNING, CRITICAL
        self.log_message = message


@router.post("/reconcile-manifest", status_code=status.HTTP_200_OK)
async def calculate_transit_leakage(payload: TransitReconciliationRequest):
    try:
        # 3. Execute the Core SEC Mass Variance Equation
        # Delta M = Mass_Field - Mass_Store
        delta_m = round(payload.mass_field - payload.mass_store, 3)

        # 4. Evaluate Variance Framework Limits
        if delta_m == 0.0:
            # Clean reconciliation: Zero leakage across regional transit network
            audit_log = SystemAuditTrailLog(
                batch_id=payload.batch_ticket_id,
                delta_m=delta_m,
                severity="INFO",
                message=f"Batch {payload.batch_ticket_id} verified. Strict mass reconciliation achieved: Delta M = 0."
            )

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": "Verified",
                    "mass_variance": delta_m,
                    "is_flagged": False,
                    "audit_checksum": audit_log.log_id,
                    "details": f"Chain-of-custody complete. Manifest cleared for weekly server registry certification."
                }
            )

        else:
            # 5. Mass Discrepancy Found: Trigger Automatic Flags & Unalterable Logs
            severity_level = "CRITICAL" if delta_m > 0.0 else "WARNING"

            # Formulate clear error tracking diagnostics
            log_msg = (
                f"Unauthorized Extraction Alert! Product leakage detected during transit. "
                f"Farm Gate scanned weight: {payload.mass_field}kg | Warehouse arrival weight: {payload.mass_store}kg. "
                f"System Loss Metrics: {delta_m}kg unallocated variance."
                if delta_m > 0.0 else
                f"Inventory Variance Alert! Inbound weight overshoot detected. "
                f"Field Weight: {payload.mass_field}kg | Store Weight: {payload.mass_store}kg. "
                f"System Overages Metric: {abs(delta_m)}kg unallocated calibration variance."
            )

            # Instantly bake the incident payload into the system audit trail records
            flagged_audit_log = SystemAuditTrailLog(
                batch_id=payload.batch_ticket_id,
                delta_m=delta_m,
                severity=severity_level,
                message=log_msg
            )

            # NOTE FOR PRODUCTION SQL EXECUTION:
            # In a live deployment, this is where you run a database write transaction to update the batch record:
            # db_batch.status = "FLAGGED"
            # db_batch.mass_variance = delta_m
            # db.add(flagged_audit_log)
            # db.commit()

            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "status": "System Flagged",
                    "mass_variance": delta_m,
                    "is_flagged": True,
                    "severity": severity_level,
                    "audit_checksum": flagged_audit_log.log_id,
                    "incident_details": flagged_audit_log.log_message,
                    "regulatory_context": "Automatic compliance hold triggered under SEC ISA 2025 \\ IV(40). Manual manifest audit required."
                }
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Security engine core fault: Processing aborted due to internal exception -> {str(e)}"
        )