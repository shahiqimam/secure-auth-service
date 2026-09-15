import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditEventType {
  Registered = 'REGISTERED',
  LoginSuccess = 'LOGIN_SUCCESS',
  LoginFailure = 'LOGIN_FAILURE',
  AccountLocked = 'ACCOUNT_LOCKED',
  AccountUnlocked = 'ACCOUNT_UNLOCKED',
  MfaEnrolled = 'MFA_ENROLLED',
  MfaDisabled = 'MFA_DISABLED',
  MfaFailure = 'MFA_FAILURE',
  RecoveryCodeUsed = 'RECOVERY_CODE_USED',
  SessionCreated = 'SESSION_CREATED',
  SessionRefreshed = 'SESSION_REFRESHED',
  SessionRevoked = 'SESSION_REVOKED',
  RefreshReuseDetected = 'REFRESH_REUSE_DETECTED',
  Logout = 'LOGOUT',
  LogoutAll = 'LOGOUT_ALL',
  PasswordChanged = 'PASSWORD_CHANGED',
  PasswordResetRequested = 'PASSWORD_RESET_REQUESTED',
  PasswordResetCompleted = 'PASSWORD_RESET_COMPLETED',
  EmailVerified = 'EMAIL_VERIFIED',
  RoleChanged = 'ROLE_CHANGED',
  UserDisabled = 'USER_DISABLED',
  UserEnabled = 'USER_ENABLED',
}

@Entity({ name: 'security_audit_events' })
export class SecurityAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: AuditEventType })
  eventType: AuditEventType;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
