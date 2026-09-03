import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    Logger.debug(`${context.getClass().name}.${context.getHandler().name}() : ${req.method} ${req.url}`, 'LoggingInterceptor');
    return next.handle();
  }
}
