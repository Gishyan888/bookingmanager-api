import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserRole } from '../../common/enums/role.enum';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  assignedHotelId: string | null;
  preferredLanguage: string;
  preferredTheme: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
