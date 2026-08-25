# Field Capture Client — Technical Specification

## 1. Project Goal
An offline-first Android application built with React Native/Expo and SQLite. It captures 18-column farmer demographic data, pairs with an ESP32 fingerprint scanner over Bluetooth, stores data locally with UUID v4 primary keys, and syncs batches to a FastAPI backend (`ingest.py`) when an internet connection is detected.

## 2. Tech Stack
- Framework: React Native / Expo (TypeScript)
- Local Storage: `expo-sqlite`
- Network State: `@react-native-community/netinfo`
- Geolocation: `expo-location`
- ID Generation: `react-native-uuid`

## 3. Database Schema (`farmer_registry`)
- `id` TEXT PRIMARY KEY (UUID v4)
- `agent_id` TEXT NOT NULL
- `device_uuid` TEXT NOT NULL
- `farmer_name` TEXT NOT NULL
- `nin` TEXT NOT NULL (11 digits, strict text string)
- `bvn` TEXT NOT NULL (11 digits, strict text string)
- `phone_number` TEXT NOT NULL
- `lga` TEXT NOT NULL
- `community_ward` TEXT NOT NULL
- `cooperative_name` TEXT NOT NULL
- `crop_type` TEXT NOT NULL
- `farm_size_hectares` REAL NOT NULL
- `estimated_yield_tonnes` REAL NOT NULL
- `latitude` REAL NOT NULL
- `longitude` REAL NOT NULL
- `biometric_template_hash` TEXT NOT NULL
- `captured_at` TEXT NOT NULL (ISO-8601 UTC)
- `sync_status` TEXT NOT NULL DEFAULT 'PENDING_SYNC' ('PENDING_SYNC', 'SYNCED', 'ERROR')
- `sync_error_message` TEXT

## 4. Key Rules
- NIN and BVN MUST NEVER be converted to integers (preserve leading zeros).
- SQLite must enforce unique constraints on `nin`, `bvn`, and `biometric_template_hash`.
- The Bluetooth listener must support a mock/simulation toggle for testing without physical hardware.
- Sync engine pushes records in batches of 10–20 to `POST /api/v1/ingest/batch`.