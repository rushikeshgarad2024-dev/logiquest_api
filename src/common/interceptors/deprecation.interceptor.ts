import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(
    private readonly deprecationDate?: string,
    private readonly warningMessage: string = 'This API version is deprecated and will be removed in a future release.',
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Set standard RFC 8594 Deprecation header
    response.setHeader('Deprecation', 'true');
    if (this.deprecationDate) {
      response.setHeader('Sunset', this.deprecationDate);
    }

    return next.handle().pipe(
      map((data) => {
        // If response is a JSON object, append deprecation metadata to response body
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return {
            ...data,
            deprecation: {
              isDeprecated: true,
              message: this.warningMessage,
              sunsetDate: this.deprecationDate || null,
            },
          };
        }
        return data;
      }),
    );
  }
}