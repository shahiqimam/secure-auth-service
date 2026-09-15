# Interview Notes

## Authentication

Simple answer: Proving who the user is.

Technical answer: AuthForge checks a normalized email and Argon2id password hash, then may require MFA before creating a session.

Likely question: Why is login not the same as authorization?

## Refresh Token

Simple answer: A longer-lived secret used only to get new access tokens.

Technical answer: AuthForge uses opaque random refresh tokens, stores only SHA-256 hashes in Redis, rotates them every use, and tracks consumed hashes for replay detection.

Likely question: Why not use a long-lived JWT refresh token?

## MFA

Simple answer: A second step after password verification.

Technical answer: AuthForge uses pending TOTP enrollment, AES-GCM protected secrets, a distinct MFA challenge token, and one-time recovery-code hashes.

Likely question: Why must enrollment be confirmed before enabling MFA?

## RBAC

Simple answer: Roles decide which authenticated users can call protected routes.

Technical answer: `RolesGuard` checks `roles` from an access token that `AccessTokenGuard` has already verified as `type=access`.

Likely question: Why can authorization not rely on frontend hiding?
