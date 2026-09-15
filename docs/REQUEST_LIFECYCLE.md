# Request Lifecycle

## POST /auth/login

`AuthController.login` calls `AuthService.login`. The service uses `UsersService`, Argon2id verification, lockout counters, audit events, and either `SessionService.createSession` or an MFA challenge token.

## POST /auth/refresh

`AuthController.refresh` reads the cookie. `AuthService.refresh` delegates rotation to `SessionService.rotate`, validates the user is still active, sets a new refresh cookie, and returns a new access token.

## GET /admin/audit

`AdminController.auditEvents` is protected by `AccessTokenGuard` and `RolesGuard` with `Role.Admin`. It returns recent events from `AuditService`.
