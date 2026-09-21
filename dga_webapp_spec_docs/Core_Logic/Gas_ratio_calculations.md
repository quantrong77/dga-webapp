# Use Case: Gas ratio calculations

**Description:** Auto-generated from code analysis. Module: Core Logic.

**Precondition:** Dissolved Gas Analysis (DGA) data is available in the system.

**Postcondition:** Calculated gas ratios are stored and ready for diagnostic assessment.

## Actors
- **System Engine**
- **Maintenance Engineer**

## Data Entities
- **Transformer Oil Sample**

## Flows
### EXCEPTION: Invalid Gas Data
1. If gas concentration values are missing or non-numeric.
2. System halts calculation.
3. System notifies the user of a data integrity error.

### MAIN
1. Engineer triggers ratio calculation for a specific asset.
2. System retrieves raw gas concentration values from the data store.
3. System applies Duval Triangle or Rogers Ratio algorithms.
4. System computes the final ratio results.
5. System updates the asset record with the new diagnostic metrics.

