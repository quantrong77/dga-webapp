# Use Case: Data normalization

**Description:** Auto-generated from code analysis. Module: Core Logic.

**Precondition:** Raw sensor data is ingested from external sources.

**Postcondition:** Data is standardized into a uniform format for processing.

## Actors
- **System Engine**

## Data Entities
- **Sensor Telemetry**

## Flows
### EXCEPTION: Schema Mismatch
1. If incoming data structure does not match expected schema.
2. System rejects the data packet.
3. System logs an error in the system audit trail.

### MAIN
1. System receives raw telemetry data from transformer sensors.
2. System converts units to a standardized format (e.g., ppm).
3. System cleans outliers and handles null values.
4. System maps data to the internal schema.
5. System stores the normalized data in the database.

