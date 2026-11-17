# MEGO FORCE Security Specification & Rules TDD

## 1. Data Invariants

1. **Master Admin Authority**: Only verified admins (`belsyvargas99@gmail.com` bootstrap or an active entry in `authorizedAdmins/{email}` with `email_verified == true`) can read or write `contracts`, `registrations`, `authorizedAdmins`, `auditLogs`, `assets`, or `settings` (except public `get` on `settings/global`).
2. **Zero Public Registration Enumeration**: Public participants NEVER have `get` or `list` access on `registrations`. Public `list` on `publicContracts` and `registrationLocks` is strictly `false`.
3. **Atomic Duplicate Cédula Guard**: Every public registration creation MUST atomically create a `registrationLocks/{contractId}_{identificationHash}` lock document in the same transaction/batch (`existsAfter` cross-check), guaranteeing duplicate identifications for the same contract are rejected even under concurrent submissions.
4. **Active Contract Gate**: Public registration creation is rejected unless `publicContracts/{publicToken}` exists, matches `contractId`, and has `status == 'active'`.
5. **Server Timestamp Integrity**: All `createdAt`, `updatedAt`, and `registrationTimestamp` fields on write MUST equal `request.time`.
6. **Immutable Audit Trail**: `auditLogs` can only be created by verified admins and NEVER updated or deleted.
7. **Self-Role Escalation Block**: Non-admin users can NEVER create or update `users/{uid}` or `authorizedAdmins/{email}` to grant themselves `admin` or `super_admin` privileges.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Public Read of PII (`registrations`)**: Unauthenticated or non-admin user attempts `get` or `list` on `/registrations` -> DENIED.
2. **Public Contract Enumeration (`publicContracts`)**: Unauthenticated user attempts `list` on `/publicContracts` -> DENIED.
3. **Ghost Field Shadow Injection on Registration**: Public user creates a registration with `paymentVerificationStatus: "verified"` or an unknown `isAdmin: true` field -> DENIED.
4. **Closed Contract Registration Bypass**: Public user submits a registration referencing a `publicContract` with `status: "closed"` or `"paused"` -> DENIED.
5. **Duplicate Lock Bypass**: Public user attempts to create `/registrations/{id}` without atomically creating the matching `/registrationLocks/{contractId}_{identificationHash}` -> DENIED.
6. **Spoofed Email Claim Without Verification**: User with `email: "belsyvargas99@gmail.com"` and `email_verified: false` attempts to read `/contracts` -> DENIED.
7. **Self-Privilege Escalation**: Non-admin authenticated user attempts to write `/authorizedAdmins/attacker@example.com` -> DENIED.
8. **Client Clock Forgery**: Public user sends `registrationTimestamp: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED.
9. **ID Poisoning (Denial of Wallet)**: Attacker writes `/registrations/<2KB-junk-id>` or invalid characters `../admin` -> DENIED.
10. **Audit Log Tampering**: Even an admin attempts to `update` or `delete` an existing `/auditLogs/{logId}` -> DENIED.
11. **Registration Lock Enumeration**: Public user attempts `list` on `/registrationLocks` -> DENIED.
12. **Unbounded String/Payload Poisoning**: Public user submits a 50KB `fullName` or `nickname` -> DENIED by strict `.size()` bounds.
