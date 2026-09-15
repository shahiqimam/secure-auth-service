import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { MfaChallengeGuard } from '../auth/guards/mfa-challenge.guard';
import { ConfirmMfaDto, DisableMfaDto, VerifyMfaDto } from './dto/mfa.dto';
import { MfaService } from './mfa.service';

@ApiTags('mfa')
@Controller()
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('mfa/enroll')
  enroll(@Req() request: Request) {
    return this.mfa.enroll(request.user!.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('mfa/confirm')
  confirm(@Req() request: Request, @Body() dto: ConfirmMfaDto) {
    return this.mfa.confirm(request.user!.sub, dto.code);
  }

  @UseGuards(MfaChallengeGuard)
  @Post('auth/mfa/verify')
  verify(
    @Req() request: Request & { mfaUser?: { sub: string } },
    @Body() dto: VerifyMfaDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.mfa.verifyChallenge(request.mfaUser!.sub, dto.code, request, response);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('mfa/disable')
  disable(@Req() request: Request, @Body() dto: DisableMfaDto) {
    return this.mfa.disable(request.user!.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('mfa/regenerate-recovery-codes')
  regenerate(@Req() request: Request) {
    return this.mfa.regenerateRecoveryCodes(request.user!.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Get('mfa/recovery-codes')
  count(@Req() request: Request) {
    return this.mfa.recoveryCodeCount(request.user!.sub);
  }
}
