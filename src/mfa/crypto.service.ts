import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class MfaCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plainText: string): string {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
  }

  decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split('.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key() {
    const raw = this.config.get<string>('MFA_ENCRYPTION_KEY');
    if (!raw) throw new Error('MFA_ENCRYPTION_KEY is required for MFA operations');
    const decoded = Buffer.from(raw, 'base64');
    return decoded.length === 32 ? decoded : Buffer.from(raw.padEnd(32, '0').slice(0, 32));
  }
}
