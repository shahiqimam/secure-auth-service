# Token Lifecycle

## Login

`AuthController.login` receives credentials. `AuthService.login` normalizes email, verifies account state, checks the Argon2id password hash, and either returns an MFA challenge or creates a Redis-backed refresh session.

## Refresh

`AuthController.refresh` reads the `refresh_token` cookie. `SessionService.rotate` hashes the presented token, finds the session, constant-time compares the hash, records the old token hash as consumed, writes the new hash, and returns a new cookie value.

## Reuse Detection

Consumed token hashes are stored under `auth:consumed:<familyId>:<hash>` and `auth:consumed-lookup:<hash>`. Presenting a consumed token triggers reuse detection and revocation.

## Logout

`AuthService.logout` clears the cookie and attempts to revoke the current session. `logout-all`, password change, and password reset revoke all refresh sessions for the user.
