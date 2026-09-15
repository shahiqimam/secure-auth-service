import { Role } from '../../common/roles';

export type AccessJwtPayload = {
  sub: string;
  email: string;
  roles: Role[];
  type: 'access';
  sessionId?: string;
};

export type MfaJwtPayload = {
  sub: string;
  purpose: 'mfa';
};

declare global {
  namespace Express {
    interface User {
      sub: string;
      email: string;
      roles: Role[];
      type: 'access';
      sessionId?: string;
    }
  }
}