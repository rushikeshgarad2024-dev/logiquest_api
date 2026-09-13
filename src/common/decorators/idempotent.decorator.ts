import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

export interface IdempotentOptions {
  required?: boolean;
  ttlSeconds?: number;
}

export const Idempotent = (
  options: IdempotentOptions = { required: true, ttlSeconds: 86400 },
): CustomDecorator<string> => SetMetadata(IDEMPOTENT_KEY, options);
