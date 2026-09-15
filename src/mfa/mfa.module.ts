import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MfaCryptoService } from './crypto.service';
import { MfaController } from './mfa.controller';
import { MfaRecoveryCode } from './mfa-recovery-code.entity';
import { MfaService } from './mfa.service';

@Module({
  imports: [TypeOrmModule.forFeature([MfaRecoveryCode]), UsersModule, AuditModule, AuthModule],
  controllers: [MfaController],
  providers: [MfaService, MfaCryptoService],
})
export class MfaModule {}
