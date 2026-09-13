import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as crypto from 'crypto';
import { IDEMPOTENT_KEY, IdempotentOptions } from '../decorators/idempotent.decorator';

interface CachedResponse {
  statusCode: number;
  responseBody: any;
  requestHash: string;
  expiresAt: number;
  inProgress?: boolean;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private static store = new Map<string, CachedResponse>();

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<IdempotentOptions>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      if (options.required !== false) {
        throw new BadRequestException(
          'Idempotency-Key header is required for this operation. Please provide a unique key.',
        );
      }
      return next.handle();
    }

    const ttlMs = (options.ttlSeconds || 86400) * 1000;
    const requestHash = this.computeHash(request);
    const now = Date.now();

    const existing = IdempotencyInterceptor.store.get(idempotencyKey);

    if (existing && existing.expiresAt > now) {
      if (existing.inProgress) {
        throw new ConflictException(
          'A request with this Idempotency-Key is currently in progress. Please retry shortly.',
        );
      }

      if (existing.requestHash !== requestHash) {
        throw new BadRequestException(
          'Idempotency key reused with different request payload or URL.',
        );
      }

      response.status(existing.statusCode);
      response.setHeader('X-Cache-Lookup', 'HIT');
      return of(existing.responseBody);
    }

    // Mark in progress
    IdempotencyInterceptor.store.set(idempotencyKey, {
      statusCode: 200,
      responseBody: null,
      requestHash,
      expiresAt: now + ttlMs,
      inProgress: true,
    });

    return next.handle().pipe(
      tap((body) => {
        const statusCode = response.statusCode || 200;
        IdempotencyInterceptor.store.set(idempotencyKey, {
          statusCode,
          responseBody: body,
          requestHash,
          expiresAt: Date.now() + ttlMs,
          inProgress: false,
        });
      }),
      catchError((err) => {
        IdempotencyInterceptor.store.delete(idempotencyKey);
        return throwError(() => err);
      }),
    );
  }

  private computeHash(req: any): string {
    const path = req.path || req.url || '';
    const bodyStr = JSON.stringify(req.body || {});
    return crypto
      .createHash('sha256')
      .update(`${path}:${bodyStr}`)
      .digest('hex');
  }

  public static clearStore(): void {
    IdempotencyInterceptor.store.clear();
  }
}
