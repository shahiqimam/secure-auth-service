# Authentication Architecture

AuthForge separates password authentication, access-token authorization, and refresh-session lifecycle.

Access tokens are short-lived JWTs produced in `src/auth/auth.service.ts`. They contain `sub`, `email`, `roles`, `type=access`, and `sessionId`. `AccessTokenGuard` rejects missing tokens and rejects non-access token payloads.

Refresh tokens are random opaque values. The API sends them only through an HTTP-only cookie named `refresh_token`. Redis stores only a SHA-256 hash of the current refresh token in `auth:session:<sessionId>` plus a hash-to-session lookup.

On refresh, `SessionService.rotate` verifies the current hash, records the old hash as consumed, replaces it with a new hash, and returns a new opaque cookie value. If a consumed hash appears again, the service treats it as replay and revokes the family/session state it can identify.

Logout deletes the Redis session and clears the cookie. Existing access tokens remain valid until their short expiration, which keeps the design simple and avoids a global JWT denylist.
