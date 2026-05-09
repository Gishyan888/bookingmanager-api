import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

/**
 * Restricts the raw email string to printable ASCII so logins and mail flows
 * stay Latin; use together with @IsEmail().
 */
export function AsciiEmail() {
  return applyDecorators(
    Matches(/^[\x21-\x7E]+$/, {
      message: 'email must use English (ASCII) characters only',
    }),
  );
}
