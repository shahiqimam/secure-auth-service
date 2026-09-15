import { BadRequestException } from '@nestjs/common';
import { AdminController } from '../src/admin/admin.controller';
import { Role } from '../src/common/roles';
import { UserStatus } from '../src/users/user.entity';

describe('AdminController', () => {
  const adminUser = {
    id: 'admin-1',
    name: 'Admin',
    email: 'admin@example.test',
    roles: [Role.Admin],
    status: UserStatus.Active,
  };

  function controller(activeAdminCount: number) {
    const users = {
      findById: jest.fn().mockResolvedValue({ ...adminUser }),
      countActiveAdmins: jest.fn().mockResolvedValue(activeAdminCount),
      setRoles: jest.fn().mockResolvedValue({ ...adminUser, roles: [Role.User] }),
      setStatus: jest.fn().mockResolvedValue({ ...adminUser, status: UserStatus.Disabled }),
      toSafeUser: jest.fn((user) => user),
      listUsers: jest.fn(),
      safeProfile: jest.fn(),
      save: jest.fn(),
    };
    const audit = { record: jest.fn(), listRecent: jest.fn() };
    return { users, controller: new AdminController(users as never, audit as never) };
  }

  it('prevents removing the final active admin role', async () => {
    const { controller: admin } = controller(1);

    await expect(admin.setRole('admin-1', { roles: [Role.User] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('prevents disabling the final active admin', async () => {
    const { controller: admin } = controller(1);

    await expect(admin.disable('admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows role changes when another active admin exists', async () => {
    const { controller: admin, users } = controller(2);

    await admin.setRole('admin-1', { roles: [Role.User] });

    expect(users.setRoles).toHaveBeenCalledWith('admin-1', [Role.User]);
  });
});
