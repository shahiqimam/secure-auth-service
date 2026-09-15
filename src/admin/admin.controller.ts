import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/security-audit-event.entity';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../common/roles';
import { UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(Role.Admin)
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  usersList() {
    return this.users.listUsers();
  }

  @Get('users/:id')
  user(@Param('id') id: string) {
    return this.users.safeProfile(id);
  }

  @Patch('users/:id/role')
  async setRole(@Param('id') id: string, @Body() dto: UpdateUserRolesDto) {
    const existing = await this.users.findById(id);
    if (
      existing?.status === UserStatus.Active &&
      existing.roles.includes(Role.Admin) &&
      !dto.roles.includes(Role.Admin) &&
      (await this.users.countActiveAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot remove the final active admin');
    }
    const user = await this.users.setRoles(id, dto.roles);
    await this.audit.record({ userId: id, eventType: AuditEventType.RoleChanged, metadata: { roles: dto.roles } });
    return this.users.toSafeUser(user);
  }

  @Post('users/:id/disable')
  async disable(@Param('id') id: string) {
    const existing = await this.users.findById(id);
    if (
      existing?.status === UserStatus.Active &&
      existing.roles.includes(Role.Admin) &&
      (await this.users.countActiveAdmins()) <= 1
    ) {
      throw new BadRequestException('Cannot disable the final active admin');
    }
    const user = await this.users.setStatus(id, UserStatus.Disabled);
    await this.audit.record({ userId: id, eventType: AuditEventType.UserDisabled });
    return this.users.toSafeUser(user);
  }

  @Post('users/:id/enable')
  async enable(@Param('id') id: string) {
    const user = await this.users.setStatus(id, UserStatus.Active);
    await this.audit.record({ userId: id, eventType: AuditEventType.UserEnabled });
    return this.users.toSafeUser(user);
  }

  @Post('users/:id/unlock')
  async unlock(@Param('id') id: string) {
    const user = await this.users.findById(id);
    if (!user) return null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await this.users.save(user);
    await this.audit.record({ userId: id, eventType: AuditEventType.AccountUnlocked });
    return this.users.toSafeUser(user);
  }

  @Get('audit')
  auditEvents() {
    return this.audit.listRecent();
  }
}
