import { ExecutionContext, CallHandler, BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new IdempotencyInterceptor(reflector);
    IdempotencyInterceptor.clearStore();
  });

  const createMockContext = (headers: Record<string, string>, body = {}, path = '/test'): ExecutionContext => {
    const req = { headers, body, path };
    const res = {
      statusCode: 200,
      status: jest.fn().mockImplementation((code) => { res.statusCode = code; return res; }),
      setHeader: jest.fn(),
    };
    return {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  };

  it('passes through when @Idempotent decorator is not present', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(null);
    const context = createMockContext({});
    const next: CallHandler = { handle: () => of({ success: true }) };

    interceptor.intercept(context, next).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        done();
      },
    });
  });

  it('throws BadRequestException when Idempotency-Key is missing on required endpoint', () => {
    jest.spyOn(reflector, 'get').mockReturnValue({ required: true, ttlSeconds: 86400 });
    const context = createMockContext({});
    const next: CallHandler = { handle: () => of({ success: true }) };

    expect(() => interceptor.intercept(context, next)).toThrow(BadRequestException);
  });

  it('executes handler and caches response on initial call with valid Idempotency-Key', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({ required: true, ttlSeconds: 86400 });
    const context = createMockContext({ 'idempotency-key': 'key-123' }, { data: 'test' });
    const next: CallHandler = { handle: () => of({ sessionId: 'session-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: (val) => {
        expect(val).toEqual({ sessionId: 'session-1' });

        // Second call with same key should return cached result
        const next2: CallHandler = { handle: jest.fn() };
        interceptor.intercept(context, next2).subscribe({
          next: (cachedVal) => {
            expect(cachedVal).toEqual({ sessionId: 'session-1' });
            expect(next2.handle).not.toHaveBeenCalled();
            done();
          },
        });
      },
    });
  });

  it('throws BadRequestException if same Idempotency-Key is reused with different payload', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({ required: true, ttlSeconds: 86400 });
    const context1 = createMockContext({ 'idempotency-key': 'key-mismatch' }, { amount: 100 });
    const next1: CallHandler = { handle: () => of({ status: 'ok' }) };

    interceptor.intercept(context1, next1).subscribe({
      next: () => {
        const context2 = createMockContext({ 'idempotency-key': 'key-mismatch' }, { amount: 500 });
        const next2: CallHandler = { handle: () => of({ status: 'ok' }) };

        expect(() => interceptor.intercept(context2, next2)).toThrow(BadRequestException);
        done();
      },
    });
  });
});
