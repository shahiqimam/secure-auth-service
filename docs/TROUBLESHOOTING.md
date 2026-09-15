# Troubleshooting

## Login always fails

Check email normalization, account status, lockout state, and whether migrations were run.

## Refresh cookie missing

Check `COOKIE_SECURE`, `COOKIE_SAME_SITE`, CORS origin, client credentials mode, and the cookie path `/api/v1/auth`.

## Old refresh token still works unexpectedly

Inspect Redis keys for `auth:refresh-lookup:*` and `auth:consumed:*`. A successful refresh should remove the old lookup and write consumed markers.

## Redis unavailable

`GET /api/v1/health/ready` will fail. Check `REDIS_HOST`, `REDIS_PORT`, and Docker service names.

## PostgreSQL unavailable

`GET /api/v1/health/ready` will fail. Check migrations, credentials, and whether the API container uses `postgres` rather than `localhost`.

## TOTP codes fail

Check device clock drift and verify the user confirmed enrollment before relying on MFA login.

## MFA challenge accepted by normal endpoint

This should not happen. `AccessTokenGuard` requires `type=access`; MFA challenge tokens use `purpose=mfa`.
