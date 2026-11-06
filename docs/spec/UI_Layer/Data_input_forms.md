# Use Case: Data input forms

**Description:** Auto-generated from code analysis. Module: UI Layer.

**Precondition:** User has permission to edit asset data.

**Postcondition:** New data is saved to the system.

## Actors
- **Maintenance Engineer**

## Data Entities
- **Oil Sample Form**

## Flows
### EXCEPTION: Validation Error
1. If input values are out of range.
2. System highlights the invalid fields.
3. System prevents form submission.

### MAIN
1. Engineer opens the data entry form.
2. Engineer inputs gas concentration values.
3. System performs client-side validation.
4. Engineer submits the form.
5. System saves the data and updates the UI.

