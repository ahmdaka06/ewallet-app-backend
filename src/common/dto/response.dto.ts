import { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export function ResponseDTO<T>(classRef: Type<T>) {
  class Response {
    @ApiProperty()
    status: boolean;

    @ApiProperty()
    message: string;

    @ApiProperty({ type: classRef })
    data: T;
  }

  Object.defineProperty(Response, 'name', {
    value: `Response_${classRef.name}`,
  });

  return Response;
}