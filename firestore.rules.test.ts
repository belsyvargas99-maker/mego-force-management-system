import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('DRAFT_firestore.rules', 'utf8');

test('Dirty Dozen #1 & #2: Default deny net and zero public list on PII/publicContracts/registrationLocks', () => {
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rules, /match \/publicContracts\/\{publicToken\}[\s\S]*?allow list: if false;/);
  assert.match(rules, /match \/registrationLocks\/\{lockId\}[\s\S]*?allow list: if false;/);
  assert.match(rules, /match \/registrations\/\{registrationId\}[\s\S]*?allow get: if isValidId\(registrationId\) && isAdmin\(\);/);
  assert.match(rules, /match \/registrations\/\{registrationId\}[\s\S]*?allow list: if isAdmin\(\);/);
});

test('Dirty Dozen #3, #4, #5: Registration creation checks active status, pending verification, and atomic registrationLocks', () => {
  assert.match(rules, /incoming\(\)\.paymentVerificationStatus == 'pending'/);
  assert.match(rules, /data\.status == 'active'/);
  assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/registrationLocks\//);
  assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/registrations\//);
});

test('Dirty Dozen #6 & #7: Email verification required and self-privilege escalation blocked', () => {
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /match \/authorizedAdmins\/\{emailId\}[\s\S]*?allow create:[\s\S]*?isAdmin\(\)/);
  assert.match(rules, /match \/users\/\{userId\}[\s\S]*?allow create:[\s\S]*?isAdmin\(\)/);
});

test('Dirty Dozen #8, #9, #10, #12: Server timestamps, ID regex guards, immutable auditLogs, and string size bounds', () => {
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.match(rules, /match \/auditLogs\/\{logId\}[\s\S]*?allow update, delete: if false;/);
  assert.match(rules, /isNonEmptyString\(data\.fullName, 2, 160\)/);
});

test('Phase 2 Security: publicBulkContracts non-listable, bulk_representative gated, and frozen productionOrders immutable', () => {
  assert.match(rules, /match \/publicBulkContracts\/\{bulkToken\}[\s\S]*?allow list: if false;/);
  assert.match(rules, /match \/bulkSubmissions\/\{submissionId\}[\s\S]*?allow list: if isAdmin\(\);/);
  assert.match(rules, /bulkRegistrationEnabled == true/);
  assert.match(rules, /match \/productionOrders\/\{orderId\}[\s\S]*?allow get: if isValidId\(orderId\) && isAdmin\(\);/);
  assert.match(rules, /existing\(\)\.isFrozen == true[\s\S]*?incoming\(\)\.isFrozen == true[\s\S]*?incoming\(\)\.version == existing\(\)\.version/);
});

test('Version 2.1 Security: individualRegistrationEnabled guard, garmentItems bound, and totalDuplicates/totalRejected receipt update allowlist', () => {
  assert.match(rules, /individualRegistrationEnabled == true/);
  assert.match(rules, /garmentItems is list && data\.garmentItems\.size\(\) <= 20/);
  assert.match(rules, /hasOnly\(\[\s*'totalSaved', 'totalRejected', 'totalDuplicates', 'pendingSyncCount', 'registrationCodes', 'rejectedReasons', 'status', 'updatedAt'\s*\]\)/);
});

