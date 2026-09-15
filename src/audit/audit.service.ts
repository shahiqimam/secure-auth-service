import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEventType, SecurityAuditEvent } from './security-audit-event.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(SecurityAuditEvent)
    private readonly events: Repository<SecurityAuditEvent>,
  ) {}

  record(input: {
    userId?: string | null;
    eventType: AuditEventType;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    return this.events.save(
      this.events.create({
        userId: input.userId ?? null,
        eventType: input.eventType,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ?? null,
      }),
    );
  }

  listRecent() {
    return this.events.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
