# Security Specification — Fleet Service Planning & Garage Management

## 1. Data Invariants
1. **Authentication & Verification:** Every Firestore write requires an authenticated, email-verified user (`request.auth != null && request.auth.token.email_verified == true`).
2. **Ownership & Admin Role:** Every document carries an `ownerUid` matching `request.auth.uid`, or access is performed by a verified bootstrapped garage admin (`anmolsggouda@gmail.com` with `email_verified == true` or document in `/admins/{uid}`).
3. **Immutable Audit Ledger (`stockMovements`):** Once created, a `StockMovement` record can never be modified or deleted (`allow update, delete: if false`).
4. **Terminal State Locking (`invoices`):** Once an invoice transitions to `status == 'cancelled'`, no subsequent updates are allowed (even for payment fields), except by a verified admin override.
5. **Booking Integrity:** Creating a `ServiceBooking` requires an existing parent vehicle document in `/vehicles/{vehicleId}` (`exists(...)`).
6. **Inventory Integrity:** Creating an `InventoryItem` requires an existing parent supplier in `/suppliers/{supplierId}` (`exists(...)`).
7. **PII Protection:** Customer contact data inside `/vehicles`, `/bookings`, `/suppliers`, and `/invoices` is never publicly readable or blanket-readable; `get` and `list` verify `resource.data.ownerUid == request.auth.uid || isAdmin()`.
8. **Path ID & Payload Bounds:** All document IDs match `^[a-zA-Z0-9_\-]+$` with length `<= 128`. All strings and bounded arrays enforce `.size()` limits to prevent resource exhaustion attacks.

## 2. "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write:** Attempt `get` or `create` on `/vehicles/veh-1` with `auth: null` -> `PERMISSION_DENIED`.
2. **Email Spoofing (`email_verified: false`):** Authenticate with `email: "anmolsggouda@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
3. **Ghost / Shadow Field Injection:** Create `/inventory/inv-99` with an undeclared field `isVerified: true` -> `PERMISSION_DENIED`.
4. **Identity Spoofing:** Authenticated user `uid: "attacker"` creates `/vehicles/veh-99` with `ownerUid: "victim"` -> `PERMISSION_DENIED`.
5. **Path ID Poisoning:** Attempt `create` at `/vehicles/` with 200-char ID or invalid characters `bad/id$!` -> `PERMISSION_DENIED`.
6. **Unbounded String Poisoning:** Create `/suppliers/sup-99` with `name` of 2,000 characters -> `PERMISSION_DENIED`.
7. **Orphaned Booking Write:** Create `/bookings/bk-orphan` referencing non-existent `vehicleId: "veh-missing"` -> `PERMISSION_DENIED`.
8. **Orphaned Inventory Write:** Create `/inventory/inv-orphan` referencing non-existent `supplierId: "sup-missing"` -> `PERMISSION_DENIED`.
9. **Audit Ledger Tampering:** Attempt `update` or `delete` on `/stockMovements/txn-1` -> `PERMISSION_DENIED`.
10. **Cancelled Invoice Re-activation:** Attempt non-admin `update` on `/invoices/inv-1` where existing `status == 'cancelled'` -> `PERMISSION_DENIED`.
11. **PII Cross-Tenant Read / Blanket List:** Non-owner `uid: "user-b"` attempts `get` or unfiltered `list` on `/invoices` owned by `uid: "user-a"` -> `PERMISSION_DENIED`.
12. **Type Poisoning on Update:** Update `/bookings/bk-1` passing numeric `workflowColumn: 12345` -> `PERMISSION_DENIED`.
