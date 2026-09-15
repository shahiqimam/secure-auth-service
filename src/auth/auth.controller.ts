import { Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.login(dto, request, response);
  }

  @ApiCookieAuth('refresh_token')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('refresh')
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.refresh(request.cookies?.refresh_token, response);
  }

  @ApiCookieAuth('refresh_token')
  @Post('logout')
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.logout(request.cookies?.refresh_token, response);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('logout-all')
  logoutAll(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.logoutAll(request.user!.sub, response);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Get('sessions')
  sessions(@Req() request: Request) {
    return this.auth.sessionsFor(request.user!.sub);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Delete('sessions/:sessionId')
  revokeSession(@Req() request: Request, @Param('sessionId') sessionId: string) {
    return this.auth.revokeSession(request.user!.sub, sessionId);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Post('change-password')
  changePassword(@Req() request: Request, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(request.user!.sub, dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}
