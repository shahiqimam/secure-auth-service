import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { IsNull, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/security-audit-event.entity';
import { randomToken } from '../common/token.util';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { MfaCryptoService } from './crypto.service';
import { DisableMfaDto } from './dto/mfa.dto';
import { MfaRecoveryCode } from './mfa-recovery-code.entity';
import { Request, Response } from 'express';

@Injectable()
export class MfaService {
  constructor(
    private readonly users: UsersService,
    private readonly crypto: MfaCryptoService,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    @InjectRepository(MfaRecoveryCode)
    private readonly codes: Repository<MfaRecoveryCode>,
  ) {}

  async enroll(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = authenticator.generateSecret();
    user.pendingMfaSecretEncryptedOrProtected = this.crypto.encrypt(secret);
    await this.users.save(user);
    return {
      manualSecret: secret,
      otpauthUri: authenticator.keyuri(user.email, 'AuthForge', secret),
    };
  }

  async confirm(userId: string, code: string) {
    const user = await this.users.findById(userId);
    if (!user?.pendingMfaSecretEncryptedOrProtected) throw new UnauthorizedException('No pending MFA enrollment');
    const secret = this.crypto.decrypt(user.pendingMfaSecretEncryptedOrProtected);
    if (!authenticator.check(code, secret)) throw new UnauthorizedException('Invalid MFA code');
    user.mfaEnabled = true;
    user.mfaSecretEncryptedOrProtected = user.pendingMfaSecretEncryptedOrProtected;
    user.pendingMfaSecretEncryptedOrProtected = null;
    await this.users.save(user);
    const recoveryCodes = await this.replaceRecoveryCodes(user.id);
    await this.audit.record({ userId: user.id, eventType: AuditEventType.MfaEnrolled });
    return { recoveryCodes };
  }

  async verifyChallenge(userId: string, code: string, request: Request, response: Response) {
    const user = await this.users.findById(userId);
    if (!user?.mfaEnabled || !user.mfaSecretEncryptedOrProtected) throw new UnauthorizedException();
    const secret = this.crypto.decrypt(user.mfaSecretEncryptedOrProtected);
    const validTotp = authenticator.check(code, secret);
    const validRecovery = validTotp ? false : await this.consumeRecoveryCode(user.id, code);
    if (!validTotp && !validRecovery) {
      await this.audit.record({ userId: user.id, eventType: AuditEventType.MfaFailure });
      throw new UnauthorizedException('Invalid MFA code');
    }
    if (validRecovery) await this.audit.record({ userId: user.id, eventType: AuditEventType.RecoveryCodeUsed });
    return this.auth.issueSession(user, request, response);
  }

  async regenerateRecoveryCodes(userId: string) {
    return { recoveryCodes: await this.replaceRecoveryCodes(userId) };
  }

  async disable(userId: string, dto: DisableMfaDto) {
    const user = await this.users.findById(userId);
    if (!user?.mfaEnabled || !user.mfaSecretEncryptedOrProtected) throw new UnauthorizedException();
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException('Invalid step-up verification');
    }
    const secret = this.crypto.decrypt(user.mfaSecretEncryptedOrProtected);
    const validTotp = authenticator.check(dto.code, secret);
    const validRecovery = validTotp ? false : await this.consumeRecoveryCode(user.id, dto.code);
    if (!validTotp && !validRecovery) throw new UnauthorizedException('Invalid step-up verification');
    user.mfaEnabled = false;
    user.mfaSecretEncryptedOrProtected = null;
    user.pendingMfaSecretEncryptedOrProtected = null;
    await this.users.save(user);
    await this.codes.delete({ userId: user.id });
    await this.audit.record({ userId: user.id, eventType: AuditEventType.MfaDisabled });
    return { message: 'MFA disabled' };
  }

  async recoveryCodeCount(userId: string) {
    return { remainingRecoveryCodes: await this.codes.count({ where: { userId, usedAt: IsNull() } }) };
  }

  private async replaceRecoveryCodes(userId: string) {
    await this.codes.delete({ userId });
    const plainCodes = Array.from({ length: 10 }, () => randomToken(9));
    await this.codes.save(
      await Promise.all(
        plainCodes.map(async (code) =>
          this.codes.create({ userId, codeHash: await argon2.hash(code, { type: argon2.argon2id }) }),
        ),
      ),
    );
    return plainCodes;
  }

  private async consumeRecoveryCode(userId: string, presented: string) {
    const codes = await this.codes.find({ where: { userId, usedAt: IsNull() } });
    for (const code of codes) {
      if (await argon2.verify(code.codeHash, presented)) {
        code.usedAt = new Date();
        await this.codes.save(code);
        return true;
      }
    }
    return false;
  }
}
