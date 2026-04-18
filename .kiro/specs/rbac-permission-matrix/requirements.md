# Requirements Document

## Introduction

This feature replaces the current hardcoded role-based access control (RBAC) system with a database-driven permission matrix. A super_admin-only UI page allows toggling permissions per role across all platform features. The system reads permissions from the database at runtime, enabling dynamic access control without code changes.

## Glossary

- **Permission_Matrix**: A database-driven table mapping roles to permissions (features/pages), represented as a grid UI with checkboxes
- **Permission**: A named access right corresponding to a platform feature or page (e.g., "customers", "billing", "reports")
- **Role**: A UserRole enum value (super_admin, admin, billing_staff, delivery_agent, read_only)
- **Permission_Service**: The backend service responsible for reading and writing permission assignments
- **Permission_API**: The REST API endpoints for managing the permission matrix
- **Matrix_Page**: The frontend page displaying the permission matrix UI
- **Authorize_Middleware**: The Express middleware that checks whether a user's role has access to a given permission

## Requirements

### Requirement 1: Permission Storage

**User Story:** As a super_admin, I want permissions stored in the database, so that I can change role access without deploying code.

#### Acceptance Criteria

1. THE Permission_Service SHALL store each permission assignment as a record linking a role to a permission name with a granted boolean
2. WHEN no permission record exists for a role-permission pair, THE Permission_Service SHALL treat the permission as denied for that role
3. THE Permission_Service SHALL treat super_admin as always having full access regardless of database records
4. THE Permission_Service SHALL define a fixed set of permission names corresponding to platform features (customers, products, pricing, subscriptions, orders, milk_summary, milk_collection, deliveries, routes, route_map, live_gps, billing, payments, reports, users, notifications, audit_logs, settings, collections_overview, agent_assignments, remittances, agent_balances, agent_collections_dashboard)

### Requirement 2: Permission Matrix API

**User Story:** As a super_admin, I want API endpoints to read and update the permission matrix, so that the UI can display and modify permissions.

#### Acceptance Criteria

1. WHEN a GET request is made to the permissions endpoint, THE Permission_API SHALL return the full matrix of all roles and their granted permissions
2. WHEN a PUT request is made with a role, permission name, and granted value, THE Permission_API SHALL update the corresponding permission record
3. WHEN a non-super_admin user calls the Permission_API, THE Permission_API SHALL return a 403 Forbidden response
4. WHEN a permission update is made for the super_admin role, THE Permission_API SHALL reject the request with a 400 error indicating super_admin permissions cannot be modified
5. WHEN a permission is updated, THE Permission_API SHALL log the change in the audit log with the acting user, role, permission, and new value

### Requirement 3: Authorize Middleware Integration

**User Story:** As a developer, I want the authorize middleware to check permissions from the database, so that route protection is dynamic.

#### Acceptance Criteria

1. WHEN a request reaches a protected route, THE Authorize_Middleware SHALL query the Permission_Service to check if the user's role has the required permission
2. WHILE the user's role is super_admin, THE Authorize_Middleware SHALL grant access to all routes without database lookup
3. IF the Permission_Service is unavailable or returns an error, THEN THE Authorize_Middleware SHALL deny access and return a 500 error
4. THE Authorize_Middleware SHALL cache permission lookups for a configurable duration to reduce database queries
5. WHEN a permission update occurs via the API, THE Permission_Service SHALL invalidate the permission cache

### Requirement 4: Permission Matrix UI Page

**User Story:** As a super_admin, I want a visual matrix page with checkboxes, so that I can easily see and toggle which roles have access to which features.

#### Acceptance Criteria

1. THE Matrix_Page SHALL display a grid with permission names as rows and roles as columns
2. THE Matrix_Page SHALL render a checkbox at each role-permission intersection indicating whether access is granted
3. WHEN a super_admin toggles a checkbox, THE Matrix_Page SHALL immediately send an update request to the Permission_API and reflect the result
4. THE Matrix_Page SHALL display the super_admin column as fully checked and disabled (non-editable)
5. WHEN the Matrix_Page loads, THE Matrix_Page SHALL fetch the current permission matrix from the Permission_API
6. IF an update request fails, THEN THE Matrix_Page SHALL revert the checkbox to its previous state and display an error message
7. THE Matrix_Page SHALL only be accessible to users with the super_admin role

### Requirement 5: Sidebar Navigation Integration

**User Story:** As a user, I want the sidebar to only show navigation items I have permission to access, so that I see a clean interface relevant to my role.

#### Acceptance Criteria

1. WHEN the Layout renders the sidebar, THE Layout SHALL fetch the current user's granted permissions and display only navigation items the user has access to
2. WHILE the user's role is super_admin, THE Layout SHALL display all navigation items without permission checks
3. WHEN permissions are updated for a role, THE Layout SHALL reflect the changes on the next page load or session refresh

### Requirement 6: Default Permission Seeding

**User Story:** As a developer, I want default permissions seeded on first deployment, so that the system works out of the box matching current hardcoded behavior.

#### Acceptance Criteria

1. WHEN the database is seeded, THE Permission_Service SHALL create default permission records matching the current hardcoded role-permission assignments in NAV_ITEMS and route files
2. THE Permission_Service SHALL not overwrite existing permission records during re-seeding (upsert with no-overwrite semantics)
3. THE Permission_Service SHALL seed permissions for all roles except super_admin (super_admin always has full access implicitly)
