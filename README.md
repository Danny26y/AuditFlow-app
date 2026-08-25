# AuditFlow — Field Capture Client & Master Registry API

[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLite](https://img.shields.io/badge/SQLite-Offline_First-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An **offline-first field enumeration and biometric capture system** built for high-integrity agricultural auditing, SEC ISA regulatory compliance, and master farmer registries. 

The project contains both an **offline-first mobile client** (React Native / Expo / SQLite) and a **high-throughput ingestion and security reconciliation backend** (FastAPI / SQLite).

---

## 📋 Table of Contents

- [Architecture Overview](#-architecture-overview)
- [Key Features](#-key-features)
- [Database Schema (18-Column Master Record)](#-database-schema-18-column-master-record)
- [Project Structure](#-project-structure)
- [Mobile Client Setup (React Native / Expo)](#-mobile-client-setup-react-native--expo)
- [Backend Ingest Pipeline Setup (FastAPI)](#-backend-ingest-pipeline-setup-fastapi)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Testing & Validation](#-testing--validation)
- [Security & Integrity Rules](#-security--integrity-rules)
- [License](#-license)

---

## 🏛 Architecture Overview

```mermaid
flowchart LR
    subgraph Field Agent Device [Field Device (Offline-First)]
        A[ESP32 Biometric Scanner / Simulator] -->|BLE / Mock| B[Capture Form UI]
        GPS[GPS Module (expo-location)] -->|Coordinates| B
        B -->|Validate 18-Cols| C[(Local SQLite DB)]
        C -->|Queue PENDING_SYNC| D[Sync Engine]
        NET[NetInfo Listener] -->|Online Trigger| D
    end

    subgraph AuditFlow Backend [AuditFlow Ingest Server]
        D -->|POST /api/v1/ingest/batch| E[FastAPI Ingest Router]
        E -->|Deduplicate & Validate| F[(Master Registry SQLite DB)]
        E -->|Audit Trail| G[SEC ISA Security Engine]
    end
```

---

## ✨ Key Features

### 📱 Mobile Field Capture Client
- **Offline-First Storage**: Powered by `expo-sqlite` with UUID v4 primary keys. Field agents can collect records in remote regions without cellular coverage.
- **18-Column Strict Validation**: Complete capture of demographic, geographic, agronomic, and biometric data.
- **Biometric Integration**: Supports ESP32 hardware fingerprint scanner pairing over Bluetooth (BLE) alongside an integrated simulation mode for testing.
- **Automated Geolocation**: Auto-detects coordinates (Latitude, Longitude) with `expo-location`.
- **Intelligent Background Sync**: Listens to network state transitions via `@react-native-community/netinfo` and automatically pushes batched records (10–20 records/batch) with exponential backoff on failure.
- **In-App Management Screens**:
  - **Capture Form**: 18-field standardized form with validation and quick-fill triggers.
  - **Sync Dashboard**: Live sync monitor, network diagnostics, retry controls, and batch configuration.
  - **Records Explorer**: Paginated local record inspection, search, and filtering by sync state (`PENDING_SYNC`, `SYNCED`, `ERROR`).
  - **Bluetooth Scanner**: Real-time scanner discovery, signal metrics, and simulated capture.

### ⚙️ Ingestion & Security Backend
- **FastAPI Core**: Async batch ingestion, deduplication, and transactional record persistence.
- **Strict Data Preservations**: Safeguards leading zeros on 11-digit strings for NIN and BVN.
- **SEC ISA Security Engine**: Manifest reconciliation and integrity verification for regulatory compliance.
- **Data Export & Diagnostics**: Built-in CSV export, record search by NIN/UUID, and system health status.

---

## 🗄 Database Schema (18-Column Master Record)

| Column | Type | Constraints / Description |
| :--- | :--- | :--- |
| `id` | `TEXT` | `PRIMARY KEY` — Unique UUID v4 |
| `agent_id` | `TEXT` | `NOT NULL` — Authenticated Enumerator ID |
| `device_uuid` | `TEXT` | `NOT NULL` — Hardware Device Identifier |
| `farmer_name` | `TEXT` | `NOT NULL` — Full Legal Name |
| `nin` | `TEXT` | `NOT NULL UNIQUE` — 11-digit National Identity Number (Strict String) |
| `bvn` | `TEXT` | `NOT NULL UNIQUE` — 11-digit Bank Verification Number (Strict String) |
| `phone_number` | `TEXT` | `NOT NULL` — Primary Mobile Number |
| `lga` | `TEXT` | `NOT NULL` — Local Government Area (Benue State registry) |
| `community_ward` | `TEXT` | `NOT NULL` — Ward / Community Name |
| `cooperative_name` | `TEXT` | `NOT NULL` — Registered Agricultural Cooperative |
| `crop_type` | `TEXT` | `NOT NULL` — Cultivated Commodity (e.g. Soya Beans, Cassava, Maize) |
| `farm_size_hectares` | `REAL` | `NOT NULL` — Cultivated Land Area |
| `estimated_yield_tonnes` | `REAL` | `NOT NULL` — Projected Harvest Yield |
| `latitude` | `REAL` | `NOT NULL` — GPS Latitude |
| `longitude` | `REAL` | `NOT NULL` — GPS Longitude |
| `biometric_template_hash` | `TEXT` | `NOT NULL UNIQUE` — SHA-256 / WSQ Biometric Hash |
| `captured_at` | `TEXT` | `NOT NULL` — ISO-8601 UTC Timestamp |
| `sync_status` | `TEXT` | `NOT NULL DEFAULT 'PENDING_SYNC'` (`PENDING_SYNC`, `SYNCED`, `ERROR`) |
| `sync_error_message` | `TEXT` | Diagnostic error message if sync fails |

---

## 📂 Project Structure

```text
field-capture-app/
├── App.tsx                      # Main application entry with bottom navigation tabs
├── app.json                     # Expo configuration file
├── eas.json                     # EAS build & distribution profiles
├── metro.config.js              # Metro bundler configuration
├── package.json                 # Node dependencies and scripts
├── PROJECT_SPEC.md              # Client technical specification
├── src/
│   ├── constants/
│   │   └── benueLocations.ts    # LGAs and wards configuration
│   ├── db/
│   │   └── database.ts          # Local SQLite initialization, CRUD, and transaction handlers
│   ├── screens/
│   │   ├── CaptureForm.tsx      # 18-column farmer capture screen
│   │   ├── SyncDashboard.tsx    # Real-time sync status & manual controls
│   │   ├── RecordsList.tsx      # Local records explorer & filter view
│   │   └── BluetoothScannerModal.tsx # ESP32 BLE scanner & simulator
│   ├── services/
│   │   ├── bluetooth.ts         # BLE discovery & template hash streamer
│   │   ├── deviceService.ts     # Device UUID and agent identity management
│   │   └── syncEngine.ts        # NetInfo watcher & batch sync dispatcher
│   ├── types/
│   │   └── index.ts             # TypeScript definitions & record contracts
│   └── utils/
│       └── validation.ts        # NIN/BVN regex, phone, and schema validation
├── backend/
│   ├── main.py                  # FastAPI application entry & CORS middleware
│   ├── database.py              # Backend SQLite database schema & migrations
│   ├── ingest.py                # Batch ingestion, export, and record retrieval APIs
│   ├── model.py                 # Pydantic schemas and serialization models
│   ├── security_engine.py       # SEC ISA security checks and manifest reconciliation
│   └── test_ingest_pipeline.py  # Automated integration & stress test suite
└── test_field_capture.js        # Client validation & offline simulation test script
```

---

## 🚀 Mobile Client Setup (React Native / Expo)

### Prerequisites
- Node.js (v18 or newer)
- npm or yarn
- Expo Go app on Android/iOS (or Android Studio / Xcode for emulators)

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Start the Expo development server
npm run start
```

### Running on Targets
```bash
# Run on Android emulator / device
npm run android

# Run on iOS simulator (macOS required)
npm run ios

# Run in Web browser
npm run web
```

---

## 🔌 Backend Ingest Pipeline Setup (FastAPI)

### Prerequisites
- Python 3.10+
- pip

### Installation & Execution
```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a virtual environment (optional but recommended)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install required Python packages
pip install fastapi uvicorn pydantic

# 4. Start the FastAPI development server
python main.py
# Server will run at http://0.0.0.0:8000 (Swagger docs available at http://localhost:8000/docs)
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check and endpoint catalog |
| `POST` | `/api/v1/ingest/batch` | Ingest batch of farmer records with atomic deduplication |
| `GET` | `/api/v1/ingest/records` | Query paginated records with filtering options |
| `GET` | `/api/v1/ingest/records/{id_or_nin}` | Look up a single farmer record by UUID or NIN |
| `GET` | `/api/v1/ingest/records/export/csv` | Download full registry as a standard CSV |
| `GET` | `/api/v1/ingest/stats/summary` | Aggregate statistics (total records, LGA counts, sync rate) |
| `POST` | `/api/v1/ingest/upload-template` | Upload raw biometric template payload |
| `POST` | `/api/v1/security/reconcile-manifest`| Run SEC ISA manifest validation and audit reconciliation |

---

## 🧪 Testing & Validation

### 1. Client Offline-Storage & Sync Test
```bash
node test_field_capture.js
```

### 2. Backend Ingestion & Security Test Suite
```bash
cd backend
python test_ingest_pipeline.py
```

---

## 🔒 Security & Integrity Rules

1. **Strict String Types for Identifiers**: NIN (11 digits) and BVN (11 digits) are preserved as raw string types across the entire pipeline to prevent the loss of leading zeros.
2. **Deterministic Deduplication**: Client and backend databases enforce unique constraints on `nin`, `bvn`, and `biometric_template_hash`.
3. **Audit Trail**: Every record is tagged with an immutable `captured_at` UTC timestamp, `agent_id`, and `device_uuid`.
4. **Resilient Sync Architecture**: Ingestion failures mark individual records with `ERROR` status and descriptive error messages without blocking unaffected records in the batch.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
