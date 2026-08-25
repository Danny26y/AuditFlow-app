import sys
import os
import uuid
import unittest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from model import Base, FarmerRegistry
from main import app
from database import get_db

# ----------------------------------------------------
# Setup Isolated Test SQLite Database
# ----------------------------------------------------
TEST_DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_registry.db")
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables in the test database
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def generate_64char_hex(index: int) -> str:
    hex_str = f"{index:04x}" * 16
    return hex_str[:64]


class TestIngestPipeline(unittest.TestCase):

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB_FILE):
            try:
                os.remove(TEST_DB_FILE)
            except Exception:
                pass

    def test_01_health_check(self):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("batch_ingest", data["endpoints"])
        print("\n[PASS] Health check endpoint /health is active.")

    def test_02_batch_ingestion_15_records_leading_zeros_and_sec_lock(self):
        """
        Tests chunked batch ingestion of 15 records.
        Verifies:
        1. Leading zero preservation on 11-digit NIN and BVN.
        2. SEC Digital Lock activation (is_locked=True).
        3. Standardized response schema with synced_ids and audit_checksum.
        """
        records = []
        for i in range(15):
            # Strict 11-digit numbers with leading zeros (e.g., '00000000000', '00000000001')
            nin_str = f"0{i:010d}"
            bvn_str = f"0{900000000 + i:010d}"
            bio_hash = generate_64char_hex(i + 1)

            rec = {
                "id": str(uuid.uuid4()),
                "agent_id": f"AGT-TEST-{i % 3 + 1:02d}",
                "device_uuid": f"DEV-TAB-X{i % 2 + 1}",
                "farmer_name": f"Farmer Test Person {i + 1}",
                "nin": nin_str,
                "bvn": bvn_str,
                "phone_number": f"0803{i:07d}",
                "lga": "Zaria",
                "community_ward": "Tudun Wada",
                "cooperative_name": "Arewa Grains & Livestock Union",
                "crop_type": "Maize, Cattle/Beef, Poultry (Broilers)",
                "farm_size_hectares": round(2.5 + (i * 0.5), 2),
                "estimated_yield_tonnes": round(7.5 + (i * 1.2), 2),
                "farm_location": f"Km {10 + i} Kano Road, Plot {i + 1}B",
                "latitude": round(11.08554 + (i * 0.001), 6),
                "longitude": round(7.71994 + (i * 0.001), 6),
                "biometric_template_hash": bio_hash,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "sync_status": "PENDING_SYNC",
                "sync_error_message": None,
            }
            records.append(rec)

        batch_payload = {
            "batch_id": str(uuid.uuid4()),
            "agent_id": "AGT-LEADER-01",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "batch_size": len(records),
            "records": records,
        }

        # Execute Batch Ingestion POST request
        response = client.post("/api/v1/ingest/batch", json=batch_payload)
        self.assertEqual(response.status_code, 200, f"Expected 200, got {response.status_code}: {response.text}")

        data = response.json()
        self.assertEqual(data["batch_id"], batch_payload["batch_id"])
        self.assertEqual(data["status"], "SUCCESS")
        self.assertEqual(data["processed_count"], 15)
        self.assertEqual(data["success_count"], 15)
        self.assertEqual(data["error_count"], 0)
        self.assertEqual(len(data["synced_ids"]), 15)
        self.assertIsNotNone(data["audit_checksum"])
        self.assertTrue(data["audit_checksum"].startswith("LOG-"))

        # Database Verification via Session
        db = TestingSessionLocal()
        try:
            db_records = db.query(FarmerRegistry).all()
            self.assertEqual(len(db_records), 15)

            # Check Record 1: NIN / BVN leading zero preservation & farm_location
            first_record = db.query(FarmerRegistry).filter(FarmerRegistry.record_uuid == records[0]["id"]).first()
            self.assertIsNotNone(first_record)
            self.assertEqual(first_record.nin, records[0]["nin"])
            self.assertTrue(first_record.nin.startswith("0"))
            self.assertEqual(len(first_record.nin), 11)
            self.assertEqual(first_record.bvn, records[0]["bvn"])
            self.assertTrue(first_record.bvn.startswith("0"))
            self.assertEqual(len(first_record.bvn), 11)
            self.assertEqual(first_record.farm_location, "Km 10 Kano Road, Plot 1B")
            self.assertTrue(first_record.is_locked)  # SEC Digital Lock active
            self.assertEqual(first_record.biometric_template_hash, records[0]["biometric_template_hash"])
            self.assertEqual(len(first_record.biometric_template_hash), 64)
            self.assertIn("Cattle/Beef", first_record.crop_type)
            print("[PASS] 15-record batch ingestion with 11-digit leading zeros & SEC digital lock verified.")

        finally:
            db.close()

    def test_03_duplicate_rejection_and_partial_batch_handling(self):
        """
        Tests that duplicate NIN, BVN, and Biometric Hash are rejected with itemized errors
        while valid new records succeed.
        """
        db = TestingSessionLocal()
        try:
            existing = db.query(FarmerRegistry).first()
            self.assertIsNotNone(existing, "Need existing records from previous test")
            existing_nin = existing.nin
            existing_bio = existing.biometric_template_hash
        finally:
            db.close()

        # Create a batch with 1 duplicate NIN, 1 duplicate Bio, and 1 fresh valid record
        fresh_rec_id = str(uuid.uuid4())
        dup_batch_records = [
            # Duplicate NIN
            {
                "id": str(uuid.uuid4()),
                "agent_id": "AGT-01",
                "device_uuid": "DEV-01",
                "farmer_name": "Duplicate NIN Person",
                "nin": existing_nin, # DUPLICATE
                "bvn": "01112223334",
                "phone_number": "08011112222",
                "lga": "Zaria",
                "community_ward": "Wusasa",
                "cooperative_name": "Union A",
                "crop_type": "Rice",
                "farm_size_hectares": 3.0,
                "estimated_yield_tonnes": 8.0,
                "latitude": 11.08,
                "longitude": 7.71,
                "biometric_template_hash": generate_64char_hex(99),
                "captured_at": datetime.now(timezone.utc).isoformat(),
            },
            # Duplicate Biometric Hash
            {
                "id": str(uuid.uuid4()),
                "agent_id": "AGT-01",
                "device_uuid": "DEV-01",
                "farmer_name": "Duplicate Bio Person",
                "nin": "07778889991",
                "bvn": "08889990002",
                "phone_number": "08022223333",
                "lga": "Zaria",
                "community_ward": "Wusasa",
                "cooperative_name": "Union B",
                "crop_type": "Cassava",
                "farm_size_hectares": 4.0,
                "estimated_yield_tonnes": 11.0,
                "latitude": 11.09,
                "longitude": 7.72,
                "biometric_template_hash": existing_bio, # DUPLICATE
                "captured_at": datetime.now(timezone.utc).isoformat(),
            },
            # Fresh Valid Record
            {
                "id": fresh_rec_id,
                "agent_id": "AGT-01",
                "device_uuid": "DEV-01",
                "farmer_name": "Valid Fresh Person",
                "nin": "09990001115",
                "bvn": "09990001116",
                "phone_number": "08033334444",
                "lga": "Zaria",
                "community_ward": "Wusasa",
                "cooperative_name": "Union C",
                "crop_type": "Maize, Goats",
                "farm_size_hectares": 2.0,
                "estimated_yield_tonnes": 6.0,
                "latitude": 11.10,
                "longitude": 7.73,
                "biometric_template_hash": generate_64char_hex(100),
                "captured_at": datetime.now(timezone.utc).isoformat(),
            }
        ]

        payload = {
            "batch_id": str(uuid.uuid4()),
            "agent_id": "AGT-TEST",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "batch_size": len(dup_batch_records),
            "records": dup_batch_records,
        }

        response = client.post("/api/v1/ingest/batch", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Status should be PARTIAL (1 success, 2 errors)
        self.assertEqual(data["status"], "PARTIAL")
        self.assertEqual(data["success_count"], 1)
        self.assertEqual(data["error_count"], 2)
        self.assertEqual(data["synced_ids"], [fresh_rec_id])

        results_map = {r["id"]: r for r in data["results"]}
        self.assertEqual(results_map[dup_batch_records[0]["id"]]["status"], "ERROR")
        self.assertIn("already registered", results_map[dup_batch_records[0]["id"]]["error_message"])
        self.assertEqual(results_map[dup_batch_records[1]["id"]]["status"], "ERROR")
        self.assertIn("Biometric hash already registered", results_map[dup_batch_records[1]["id"]]["error_message"])
        self.assertEqual(results_map[fresh_rec_id]["status"], "SUCCESS")
        print("[PASS] Duplicate NIN and Biometric Hash rejection verified.")

    def test_04_sec_weighbridge_reconciliation(self):
        """
        Tests SEC mass variance reconciliation equation from security_engine.py
        """
        clean_payload = {
            "batch_ticket_id": "BATCH-2026-MKD-089A",
            "soft_id_token": "SOFT-ID-992384",
            "enumerator_id": "ENUM-MKD-BRB-01",
            "mass_field": 500.0,
            "mass_store": 500.0,
            "weighbridge_operator_id": "OP-WHD-04"
        }
        res_clean = client.post("/api/v1/security/reconcile-manifest", json=clean_payload)
        self.assertEqual(res_clean.status_code, 200)
        self.assertEqual(res_clean.json()["status"], "Verified")
        self.assertEqual(res_clean.json()["is_flagged"], False)
        self.assertEqual(res_clean.json()["mass_variance"], 0.0)

        leak_payload = {
            "batch_ticket_id": "BATCH-2026-MKD-090B",
            "soft_id_token": "SOFT-ID-992385",
            "enumerator_id": "ENUM-MKD-BRB-01",
            "mass_field": 500.0,
            "mass_store": 475.0, # 25kg lost
            "weighbridge_operator_id": "OP-WHD-04"
        }
        res_leak = client.post("/api/v1/security/reconcile-manifest", json=leak_payload)
        self.assertEqual(res_leak.status_code, 202)
        self.assertEqual(res_leak.json()["status"], "System Flagged")
        self.assertEqual(res_leak.json()["is_flagged"], True)
        self.assertEqual(res_leak.json()["mass_variance"], 25.0)
        print("[PASS] SEC weighbridge mass variance equations and auto-flagging verified.")

    def test_05_list_and_filter_records(self):
        """
        Tests GET /api/v1/ingest/records to pull paginated records from central server.
        """
        response = client.get("/api/v1/ingest/records?limit=10&offset=0")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreater(data["total_count"], 0)
        self.assertEqual(len(data["records"]), 10)
        first_rec = data["records"][0]
        self.assertIn("nin", first_rec)
        self.assertTrue(first_rec["nin"].startswith("0"))
        self.assertTrue(first_rec["is_locked"])
        print(f"[PASS] Retrieved {data['total_count']} master records via GET /api/v1/ingest/records.")

    def test_06_get_single_farmer_record_by_nin(self):
        """
        Tests GET /api/v1/ingest/records/{id_or_nin} to pull a specific record.
        """
        nin_target = "00000000000"
        response = client.get(f"/api/v1/ingest/records/{nin_target}")
        self.assertEqual(response.status_code, 200)
        record = response.json()
        self.assertEqual(record["nin"], nin_target)
        self.assertEqual(record["lga"], "Zaria")
        self.assertTrue(record["is_locked"])
        print(f"[PASS] Successfully retrieved specific farmer profile for NIN '{nin_target}'.")

    def test_07_stats_summary_endpoint(self):
        """
        Tests GET /api/v1/ingest/stats/summary for analytics dashboards.
        """
        response = client.get("/api/v1/ingest/stats/summary")
        self.assertEqual(response.status_code, 200)
        stats = response.json()
        self.assertGreater(stats["total_registered_farmers"], 0)
        self.assertGreater(stats["sec_digital_locked_records"], 0)
        self.assertGreater(stats["total_farm_area_hectares"], 0)
        print(f"[PASS] Master stats: {stats['total_registered_farmers']} farmers, {stats['total_farm_area_hectares']} ha.")

    def test_08_export_csv_endpoint(self):
        """
        Tests GET /api/v1/ingest/records/export/csv to download verified registry.
        """
        response = client.get("/api/v1/ingest/records/export/csv")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response.headers["content-type"])
        content = response.text
        self.assertIn("Record UUID,Agent ID,Device UUID", content)
        self.assertIn("00000000000", content)
        print("[PASS] Master CSV Export endpoint generated verified spreadsheet data.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
