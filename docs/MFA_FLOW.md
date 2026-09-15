# MFA Flow

`POST /api/v1/mfa/enroll` creates a TOTP secret and stores it as pending encrypted data. MFA remains disabled until `POST /api/v1/mfa/confirm` receives a valid TOTP code.

Confirmed secrets are protected with AES-256-GCM in `src/mfa/crypto.service.ts` using `MFA_ENCRYPTION_KEY`.

When MFA is enabled, password login returns a short-lived challenge token with `purpose=mfa` instead of creating a normal session. `POST /api/v1/auth/mfa/verify` accepts that challenge and a TOTP or recovery code, then creates the refresh session.

Recovery codes are generated once, returned once, and stored only as Argon2id hashes.

TOTP adds a second factor but is still susceptible to real-time phishing/proxy attacks. Hardware-backed/passkey/WebAuthn approaches can provide stronger phishing resistance.
