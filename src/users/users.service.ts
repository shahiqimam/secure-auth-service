import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeEmail } from '../common/email';
import { Role } from '../common/roles';
import { User, UserStatus } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  findByEmail(email: string) {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  async createUser(input: { name: string; email: string; passwordHash: string }) {
    const user = this.users.create({
      name: input.name,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      roles: [Role.User],
    });
    return this.users.save(user);
  }

  async save(user: User) {
    return this.users.save(user);
  }

  async safeProfile(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toSafeUser(user);
  }

  toSafeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      roles: user.roles,
      mfaEnabled: user.mfaEnabled,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async listUsers() {
    const users = await this.users.find({ order: { createdAt: 'DESC' } });
    return users.map((user) => this.toSafeUser(user));
  }

  async setStatus(id: string, status: UserStatus) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.status = status;
    if (status === UserStatus.Active) user.lockedUntil = null;
    return this.users.save(user);
  }

  async setRoles(id: string, roles: Role[]) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.roles = roles;
    return this.users.save(user);
  }
}
