import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignOwnerDto {
  @ApiProperty({ description: 'User id of the new owner' })
  @IsUUID()
  ownerId: string;
}
