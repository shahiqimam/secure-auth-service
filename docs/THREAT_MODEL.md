# Threat Model

| Threat | Implemented mitigation | Remaining limitation |
| --- | --- | --- |
| Credential stuffing | Login throttling, account lockout, generic errors | App throttling is not a full DDoS defense |
| Password database leak | Argon2id password hashes | Password quality still matters |
| Refresh-token theft | HTTP-only cookie, hash-only Redis storage, rotation | Stolen current token can be used until rotation/revocation |
| Refresh replay | Consumed-token markers detect old-token reuse | Family revocation is Redis-state dependent |
| MFA bypass | Distinct MFA challenge token and access-token guard | TOTP is not phishing resistant |
| Role escalation | Server-side roles guard | Admin workflows need stronger final-admin protection |
| Reset-token theft | High-entropy token, hash-only storage, one-time use | Development mode can return token for testing |
| CSRF on refresh | POST endpoint, SameSite cookie configuration | Cross-site deployments need explicit CSRF protection |
| Secret leakage | No credential/token audit metadata | Operational logs still need review |
