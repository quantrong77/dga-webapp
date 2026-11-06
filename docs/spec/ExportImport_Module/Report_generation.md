# Use Case: Report generation

**Description:** Auto-generated from code analysis. Module: Export/Import Module.

**Precondition:** Data is available for the reporting period.

**Postcondition:** A PDF or CSV report is generated.

## Actors
- **Maintenance Manager**

## Data Entities
- **Report Template**

## Flows
### EXCEPTION: Data Timeout
1. If data aggregation takes too long.
2. System cancels the request.
3. System prompts the user to select a smaller date range.

### MAIN
1. Manager selects the report type and date range.
2. System aggregates the required data.
3. System applies the report template.
4. System generates the file in the requested format.
5. System triggers a download for the user.

