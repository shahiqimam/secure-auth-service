import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialAuthForgeSchema1735000000000 implements MigrationInterface {
  name = 'InitialAuthForgeSchema1735000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE TYPE "user_status_enum" AS ENUM ('ACTIVE', 'DISABLED')`);
    await queryRunner.query(`CREATE TYPE "audit_event_type_enum" AS ENUM (
      'REGISTERED','LOGIN_SUCCESS','LOGIN_FAILURE','ACCOUNT_LOCKED','ACCOUNT_UNLOCKED',
      'MFA_ENROLLED','MFA_DISABLED','MFA_FAILURE','RECOVERY_CODE_USED','SESSION_CREATED',
      'SESSION_REFRESHED','SESSION_REVOKED','REFRESH_REUSE_DETECTED','LOGOUT','LOGOUT_ALL',
      'PASSWORD_CHANGED','PASSWORD_RESET_REQUESTED','PASSWORD_RESET_COMPLETED','EMAIL_VERIFIED',
      'ROLE_CHANGED','USER_DISABLED','USER_ENABLED'
    )`);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        "status" "user_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "failedLoginAttempts" int NOT NULL DEFAULT 0,
        "lockedUntil" timestamptz,
        "emailVerifiedAt" timestamptz,
        "mfaEnabled" boolean NOT NULL DEFAULT false,
        "mfaSecretEncryptedOrProtected" text,
        "pendingMfaSecretEncryptedOrProtected" text,
        "roles" text[] NOT NULL DEFAULT '{USER}',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        "lastLoginAt" timestamptz,
        "passwordChangedAt" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar NOT NULL UNIQUE,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_password_reset_user" ON "password_reset_tokens" ("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_password_reset_expires" ON "password_reset_tokens" ("expiresAt")`);
    await queryRunner.query(`
      CREATE TABLE "mfa_recovery_codes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "codeHash" varchar NOT NULL,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_mfa_codes_user" ON "mfa_recovery_codes" ("userId")`);
    await queryRunner.query(`
      CREATE TABLE "security_audit_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "eventType" "audit_event_type_enum" NOT NULL,
        "ipAddress" varchar,
        "userAgent" varchar,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_user" ON "security_audit_events" ("userId")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_created" ON "security_audit_events" ("createdAt")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "security_audit_events"`);
    await queryRunner.query(`DROP TABLE "mfa_recovery_codes"`);
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "audit_event_type_enum"`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
  }
}
