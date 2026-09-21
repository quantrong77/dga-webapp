# Use Case: Standard compliance checks

**Description:** Auto-generated from code analysis. Module: Core Logic.

**Precondition:** Calculated gas ratios are present.

**Postcondition:** Compliance status is flagged as 'Compliant' or 'Non-Compliant'.

## Actors
- **Compliance Officer**
- **System Engine**

## Data Entities
- **Compliance Standard**

## Flows
### EXCEPTION: Unknown Standard Version
1. If the selected standard version is deprecated.
2. System defaults to the latest available standard.
3. System warns the user about the version mismatch.

### MAIN
1. System compares calculated ratios against IEEE/IEC standards.
2. System evaluates the threshold limits for the specific transformer type.
3. System determines the compliance status based on predefined limits.
4. System logs the compliance check result.
5. System updates the UI dashboard with the compliance status.

