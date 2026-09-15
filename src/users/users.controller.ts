import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Req() request: Request) {
    return this.users.safeProfile(request.user!.sub);
  }

  @Patch('me')
  async updateMe(@Req() request: Request, @Body() dto: UpdateProfileDto) {
    const user = await this.users.findById(request.user!.sub);
    if (!user) return null;
    if (dto.name) user.name = dto.name;
    return this.users.toSafeUser(await this.users.save(user));
  }
}
