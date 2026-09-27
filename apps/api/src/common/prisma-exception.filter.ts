import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/** Maps known Prisma errors to HTTP errors instead of a generic 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    switch (exception.code) {
      case 'P2002':
        return super.catch(
          new ConflictException(
            'A record with the same unique value already exists',
          ),
          host,
        );
      case 'P2025':
        return super.catch(new NotFoundException('Record not found'), host);
      case 'P2003': {
        // Deleting a parent that still has children vs. referencing a missing parent.
        const { method } = host.switchToHttp().getRequest<Request>();
        return super.catch(
          method === 'DELETE'
            ? new ConflictException(
                'Record is still referenced by other records',
              )
            : new BadRequestException('Referenced record does not exist'),
          host,
        );
      }
      default:
        return super.catch(exception, host);
    }
  }
}
