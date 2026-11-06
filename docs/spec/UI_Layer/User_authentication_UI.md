# Use Case: User authentication UI

**Description:** Auto-generated from code analysis. Module: UI Layer.

**Precondition:** User is at the login screen.

**Postcondition:** User is authenticated and redirected to the dashboard.

## Actors
- **User**

## Data Entities
- **User Credentials**

## Flows
### EXCEPTION: Invalid Credentials
1. If credentials do not match.
2. System displays an error message.
3. System clears the password field.

### MAIN
1. User enters email and password.
2. System validates input fields.
3. System sends credentials to the authentication service.
4. System receives an authentication token.
5. System redirects the user to the main interface.

