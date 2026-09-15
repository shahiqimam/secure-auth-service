import { ArrayMinSize, IsArray, IsEnum } from 'class-validator';
import { Role } from '../../common/roles';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Role, { each: true })
  roles: Role[];
}
