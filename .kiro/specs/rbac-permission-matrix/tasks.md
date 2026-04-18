# Implementation Plan: RBAC Permission Matrix

## Overview

Replace the hardcoded role-array authorization system with a database-driven permission matrix. Implementation follows a bottom-up approach: schema → service → API → middleware migration → frontend → seeding → tests → checkpoint.

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Add RolePermission model to Prisma schema and generate migration
    - Add `RolePermission` model to `prisma/schema.prisma` with fields: id (UUID), role (UserRole), permission (VarChar 100), granted (Boolean), createdAt, updatedAt
    - Add unique constraint on `(role, permission)` and index on `role`
    - Generate migration file `prisma/migrations/YYYYMMDD_rbac_permission_matrix/migration.sql`
    - _Requirements: 1.1, 1.4_

- [x] 2. Permission service and types
  - [x] 2.1 Create permission types and validation schemas
    - Create `src/server/modules/permissions/permissions.types.ts`
    - Define `PERMISSION_NAMES` const array with all 23 platform feature names
    - Define `MANAGEABLE_ROLES` const array (admin, billing_staff, delivery_agent, read_only)
    - Define `PermissionName` type, `PermissionMatrix` interface
    - Define `updatePermissionSchema` Zod schema validating role, permission, and granted fields
    - _Requirements: 1.4, 2.2_

  - [x] 2.2 Implement permission service with in-memory caching
    - Create `src/server/modules/permissions/permissions.service.ts`
    - Implement `getPermissionMatrix()` — returns full matrix for all manageable roles
    - Implement `hasPermission(role, permission)` — super_admin always returns true; checks cache then DB
    - Implement `setPermission(role, permission, granted)` — upserts DB record and invalidates cache
    - Implement `getPermissionsForRole(role)` — returns array of granted permission names
    - Implement `invalidateCache()` — clears the in-memory Map cache
    - Cache: `Map<string, Map<string, boolean>>` with configurable TTL (default 5 min)
    - On first access per role, load all permissions for that role in a single query
    - _Requirements: 1.1, 1.2, 1.3, 3.4, 3.5_

  - [ ]* 2.3 Write property test: super_admin always has full access
    - **Property 1: Super_admin always has full access**
    - Generate random permission names from PERMISSION_NAMES, call `hasPermission('super_admin', perm)`, assert always true
    - **Validates: Requirements 1.3, 3.2**

  - [ ]* 2.4 Write property test: missing permission record means denied
    - **Property 2: Missing permission record means denied**
    - Generate random (role, permission) pairs for non-super_admin roles with empty DB, assert `hasPermission` returns false
    - **Validates: Requirements 1.2, 3.1**

  - [ ]* 2.5 Write property test: permission update round-trip with cache invalidation
    - **Property 3: Permission update round-trip with cache invalidation**
    - Generate random (role, permission, granted) triples, call `setPermission` then `hasPermission`, assert equality
    - **Validates: Requirements 1.1, 2.2, 3.5**

  - [ ]* 2.6 Write property test: permission matrix completeness
    - **Property 5: Permission matrix completeness**
    - Generate random subsets of permissions as granted in DB, call `getPermissionMatrix()`, verify all manageable roles and all permission names present with correct boolean values
    - **Validates: Requirements 2.1**

- [x] 3. Permission controller and routes
  - [x] 3.1 Implement permission controller
    - Create `src/server/modules/permissions/permissions.controller.ts`
    - Implement `getMatrix` — calls `getPermissionMatrix()`, returns full matrix JSON
    - Implement `updatePermission` — validates super_admin role of requester (defense-in-depth), rejects updates to super_admin role with 400, calls `setPermission`, invalidates cache
    - Implement `getMyPermissions` — calls `getPermissionsForRole(req.session.userRole)`, returns granted permission names array; super_admin returns all PERMISSION_NAMES
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Create permission routes
    - Create `src/server/modules/permissions/permissions.routes.ts`
    - `GET /` — authenticate + authorize('permissions') + getMatrix
    - `PUT /` — authenticate + authorize('permissions') + csrfProtection + validate(updatePermissionSchema) + auditLog() + updatePermission
    - `GET /me` — authenticate + getMyPermissions (any authenticated user)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Register permission routes in server index
    - Import and mount permission router at `/api/v1/permissions` in `src/server/index.ts`
    - _Requirements: 2.1_

- [x] 4. Checkpoint - Verify permission service and API
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update authorize middleware
  - [x] 5.1 Rewrite authorize middleware to use permission-based lookup
    - Update `src/server/middleware/authorize.ts` to accept a `string` (permission name) instead of `string[]` (role array)
    - super_admin always passes without DB lookup
    - Non-super_admin: call `permissionService.hasPermission(role, permission)`
    - On service error: return 500 (fail-closed)
    - Update `src/server/middleware/authorize.test.ts` to test new signature
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 5.2 Write property test: authorize middleware denies on service error
    - **Property 9: Authorize middleware denies on service error**
    - For any non-super_admin role and any permission, if Permission_Service throws, middleware responds with 500
    - **Validates: Requirements 3.3**

  - [ ]* 5.3 Write property test: cache reduces database queries
    - **Property 10: Cache reduces database queries**
    - After first `hasPermission` call loads from DB, subsequent calls within TTL should not trigger additional DB queries
    - **Validates: Requirements 3.4**

- [x] 6. Migrate all existing route files to new authorize signature
  - [x] 6.1 Update customers routes
    - Replace `authorize([...roles])` calls with `authorize('customers')` in `src/server/modules/customers/customers.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.2 Update products routes
    - Replace `authorize(adminPlus)` / `authorize(adminOnly)` / `authorize(pricingEditors)` calls with `authorize('products')` in `src/server/modules/products/products.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.3 Update pricing-categories routes
    - Replace `authorize([...])` calls with `authorize('pricing')` in `src/server/modules/pricing-categories/pricing-categories.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.4 Update subscriptions routes
    - Replace `authorize(adminPlus)` / `authorize(adminOnly)` calls with `authorize('subscriptions')` in `src/server/modules/subscriptions/subscriptions.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.5 Update orders routes
    - Replace authorize calls with `authorize('orders')` in `src/server/modules/orders/orders.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.6 Update delivery routes
    - Replace authorize calls with `authorize('deliveries')` in `src/server/modules/delivery/delivery.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.7 Update routes routes
    - Replace authorize calls with `authorize('routes')` in `src/server/modules/routes/routes.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.8 Update billing routes
    - Replace authorize calls with `authorize('billing')` in `src/server/modules/billing/billing.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.9 Update payments routes
    - Replace authorize calls with `authorize('payments')` in `src/server/modules/payments/payments.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.10 Update reports routes
    - Replace `authorize(reportRoles)` calls with `authorize('reports')` in `src/server/modules/reports/reports.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.11 Update users routes
    - Replace `authorize(['super_admin'])` with `authorize('users')` in `src/server/modules/users/users.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.12 Update notifications routes
    - Replace authorize calls with `authorize('notifications')` in `src/server/modules/notifications/notifications.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.13 Update audit routes
    - Replace authorize calls with `authorize('audit_logs')` in `src/server/modules/audit/audit.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.14 Update settings routes
    - Replace `authorize(['super_admin'])` with `authorize('settings')` in `src/server/modules/settings/settings.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.15 Update milk-collections routes
    - Replace authorize calls with `authorize('milk_collection')` in `src/server/modules/milk-collections/milk-collections.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.16 Update inventory routes
    - Replace authorize calls with appropriate permission name in `src/server/modules/inventory/inventory.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.17 Update holidays routes
    - Replace authorize calls with appropriate permission name in `src/server/modules/holidays/holidays.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.18 Update ledger routes
    - Replace authorize calls with appropriate permission name in `src/server/modules/ledger/ledger.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.19 Update agent-assignments routes
    - Replace authorize calls with `authorize('agent_assignments')` in `src/server/modules/agent-assignments/agent-assignments.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.20 Update agent-remittances routes
    - Replace authorize calls with `authorize('remittances')` in `src/server/modules/agent-remittances/agent-remittances.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.21 Update agent-collections routes
    - Replace authorize calls with `authorize('agent_collections_dashboard')` in `src/server/modules/agent-collections/agent-collections.routes.ts`
    - _Requirements: 3.1_

  - [x] 6.22 Update handover routes
    - Replace authorize calls with appropriate permission name in `src/server/modules/handover/handover.routes.ts`
    - _Requirements: 3.1_

- [x] 7. Checkpoint - Verify middleware migration
  - Ensure all tests pass and all route files compile without errors, ask the user if questions arise.

- [x] 8. Frontend permission matrix page
  - [x] 8.1 Create PermissionMatrixPage component
    - Create `src/client/pages/settings/PermissionMatrixPage.tsx`
    - Fetch full matrix via `GET /api/v1/permissions` using React Query
    - Render grid: rows = permission names (human-readable labels), columns = roles
    - Each cell is a checkbox (checked = granted)
    - super_admin column: all checked, disabled (non-editable)
    - On toggle: send `PUT /api/v1/permissions` with optimistic update; revert + toast on error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 8.2 Add route for PermissionMatrixPage in App.tsx
    - Add route `/settings/permissions` pointing to PermissionMatrixPage
    - Ensure route is only accessible to super_admin (route guard)
    - _Requirements: 4.7_

- [x] 9. Sidebar integration with permissions
  - [x] 9.1 Create usePermissions hook
    - Create `src/client/hooks/usePermissions.ts`
    - Fetch `GET /api/v1/permissions/me` using React Query
    - Return a `Set<string>` of granted permission names
    - super_admin returns all permissions without API call
    - _Requirements: 5.1, 5.2_

  - [x] 9.2 Update Layout.tsx to use permission-based sidebar filtering
    - Add `permission` key to each NAV_ITEM matching the DB permission name (Dashboard has no permission — always visible)
    - Replace role-based `getVisibleItems` with permission-based filtering using `usePermissions` hook
    - super_admin sees all items without permission check
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 9.3 Write property test: sidebar shows only permitted items
    - **Property 6: Sidebar shows only permitted items**
    - Generate random permission sets, filter NAV_ITEMS, verify output matches expected visible items
    - **Validates: Requirements 5.1**

- [x] 10. Default permission seeding
  - [x] 10.1 Add permission seed function to prisma/seed.ts
    - Create seed data matching current hardcoded NAV_ITEMS and COLLECTION_NAV_ITEMS role arrays
    - Use `upsert` with create-only semantics (no overwrite of existing records)
    - Seed permissions for all manageable roles (admin, billing_staff, delivery_agent, read_only) — not super_admin
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 10.2 Write property test: seed idempotence
    - **Property 7: Seed idempotence**
    - Generate random existing permission states, run seed, verify no existing records changed
    - **Validates: Requirements 6.2**

  - [ ]* 10.3 Write property test: seed correctness for non-super_admin roles
    - **Property 8: Seed correctness for non-super_admin roles**
    - After seed, verify all non-super_admin roles have correct records and no super_admin records exist
    - **Validates: Requirements 6.1, 6.3**

- [x] 11. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design uses TypeScript throughout — all implementation uses TypeScript
- Property tests use fast-check with Vitest (minimum 100 iterations per property)
- The authorize middleware signature change is backward-incompatible; all route files must be updated in task 6
- Checkpoints at tasks 4, 7, and 11 ensure incremental validation
