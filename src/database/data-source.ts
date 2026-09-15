import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { PasswordResetToken } from '../auth/password-reset-token.entity';
import { SecurityAuditEvent } from '../audit/security-audit-event.entity';
import { MfaRecoveryCode } from '../mfa/mfa-recovery-code.entity';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER ?? 'authforge',
  password: process.env.DATABASE_PASSWORD ?? 'change_me',
  database: process.env.DATABASE_NAME ?? 'authforge',
  entities: [User, PasswordResetToken, SecurityAuditEvent, MfaRecoveryCode],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
