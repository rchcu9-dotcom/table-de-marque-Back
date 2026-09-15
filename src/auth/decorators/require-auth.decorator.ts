import { SetMetadata } from '@nestjs/common';

export const REQUIRE_AUTH_KEY = 'requireAuth';
export const RequireAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_AUTH_KEY, true);
