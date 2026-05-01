import {
    Injectable,
    type CallHandler,
    type ExecutionContext,
    type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { SuccessResponse } from '../types/response.type';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
    intercept(
        _context: ExecutionContext,
        next: CallHandler<T>,
    ): Observable<SuccessResponse<T>> {
        return next.handle().pipe(
            map((data) => ({
                status: true,
                message: 'OK',
                data,
            })),
        );
    }
}