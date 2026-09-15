import { IsString, Length } from 'class-validator';

export class ConfirmMfaDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class VerifyMfaDto {
  @IsString()
  challengeToken: string;

  @IsString()
  code: string;
}

export class DisableMfaDto {
  @IsString()
  currentPassword: string;

  @IsString()
  code: string;
}
