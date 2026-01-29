import { ApiProperty } from '@nestjs/swagger';
import { BooleanString } from '@waha/nestjs/validation/BooleanString';
import { PaginationParams } from '@waha/structures/pagination.dto';
import { ChatIdProperty } from '@waha/structures/properties.dto';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { SessionBaseRequest, SessionQuery } from './base.dto';

/**
 * Queries
 */

export class ContactQuery extends SessionQuery {
  @ChatIdProperty()
  @IsString()
  contactId: string;
}

export class ContactProfilePictureQuery extends ContactQuery {
  @Transform(BooleanString)
  @IsBoolean()
  @IsOptional()
  @ApiProperty({
    example: false,
    required: false,
    description:
      'Refresh the picture from the server (24h cache by default). Do not refresh if not needed, you can get rate limit error',
  })
  refresh?: boolean = false;
}

export enum ContactSortField {
  ID = 'id',
  NAME = 'name',
}

export class ContactsPaginationParams extends PaginationParams {
  @ApiProperty({
    description: 'Sort by field',
    enum: ContactSortField,
  })
  @IsOptional()
  @IsEnum(ContactSortField)
  sortBy?: string;
}

/**
 * Requests
 */

export class ContactRequest extends SessionBaseRequest {
  @ChatIdProperty()
  @IsString()
  contactId: string;
}

export class ContactUpdateBody {
  @ApiProperty({
    description: 'Contact First Name',
    example: 'John',
    required: true,
  })
  @IsString()
  firstName: string = 'John';

  @ApiProperty({
    description: 'Contact Last Name',
    example: 'Doe',
    required: true,
  })
  @IsString()
  lastName: string = 'Doe';
}
