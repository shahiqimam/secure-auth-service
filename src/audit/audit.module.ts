import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityAuditEvent } from './security-audit-event.entity';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([SecurityAuditEvent])],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
