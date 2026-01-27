import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { BinaryFile } from '@waha/structures/files.dto';
import { Request } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { Observable } from 'rxjs';

@Injectable()
export class WAHAFileInterceptor implements NestInterceptor {
  private multipartInterceptor: NestInterceptor;

  constructor() {
    const Interceptor = AnyFilesInterceptor();
    this.multipartInterceptor = new Interceptor();
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      return this.multipartInterceptor.intercept(context, {
        handle: () => {
          this.processMultipart(req);
          return next.handle();
        },
      });
    } else {
      await this.processRawBody(req);
      return next.handle();
    }
  }

  private processMultipart(req: any) {
    if (!req.files || req.files.length === 0) {
      return;
    }

    // Prioritize 'file' or 'files' field
    let file = req.files.find(
      (f: any) => f.fieldname === 'file' || f.fieldname === 'files',
    );
    // If not found, take the first one
    if (!file) {
      file = req.files[0];
    }

    if (file) {
      this.attachFileToBody(req, file.buffer, file.mimetype, file.originalname);
    }
  }

  private async processRawBody(req: Request) {
    // If body is already parsed (e.g. JSON), skip
    const contentType = req.headers['content-type'] || '';
    if (
      contentType.includes('application/json') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      return;
    }

    // Try to read stream
    const buffer = await this.readStream(req);
    if (buffer && buffer.length > 0) {
      // Guess mimetype
      let mimetype = contentType.split(';')[0].trim();
      if (!mimetype || mimetype === 'application/octet-stream') {
        const result = await fileTypeFromBuffer(buffer);
        if (result) {
          mimetype = result.mime;
        } else {
          mimetype = 'application/octet-stream';
        }
      }

      const filename = 'file.bin'; // Default filename for raw upload
      this.attachFileToBody(req, buffer, mimetype, filename);
    }
  }

  private attachFileToBody(
    req: any,
    buffer: Buffer,
    mimetype: string,
    filename: string,
  ) {
    if (!req.body) {
      req.body = {};
    }
    // If req.body is not an object (e.g. null), make it object
    if (typeof req.body !== 'object' || req.body === null) {
      req.body = {};
    }

    const binaryFile: BinaryFile = {
      mimetype: mimetype,
      filename: filename,
      data: buffer.toString('base64'),
    };

    req.body.file = binaryFile;
  }

  private async readStream(stream: any): Promise<Buffer> {
    if (!stream.readable) {
      return Buffer.alloc(0);
    }

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err: Error) => reject(err));
    });
  }
}

