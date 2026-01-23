import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import { Readable } from 'stream';

import { WAHAFileInterceptor } from './WAHAFileInterceptor';

describe('WAHAFileInterceptor', () => {
  let interceptor: WAHAFileInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WAHAFileInterceptor],
    }).compile();

    interceptor = module.get<WAHAFileInterceptor>(WAHAFileInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should handle multipart request with "file" field', async () => {
    const fileBuffer = Buffer.from('test file content');
    const mockRequest = {
      headers: {
        'content-type': 'multipart/form-data; boundary=boundary',
      },
      files: [
        {
          fieldname: 'file',
          buffer: fileBuffer,
          mimetype: 'text/plain',
          originalname: 'test.txt',
        },
      ],
      body: {},
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const mockNext: CallHandler = {
      handle: () => of(null),
    };

    // Mock multipartInterceptor to verify it's called and proceed
    (interceptor as any).multipartInterceptor = {
      intercept: (context: any, next: any) => {
        // In real execution, Multer would run here and populate req.files
        // Here we simulated req.files already, so we just run the handler which calls processMultipart
        return next.handle();
      },
    };

    const obs = await interceptor.intercept(mockContext, mockNext);
    await lastValueFrom(obs);

    expect((mockRequest as any).body.file).toBeDefined();
    expect((mockRequest as any).body.file.mimetype).toBe('text/plain');
    expect((mockRequest as any).body.file.data).toBe(
      fileBuffer.toString('base64'),
    );
    expect((mockRequest as any).body.file.filename).toBe('test.txt');
  });

  it('should handle multipart request with "files" field', async () => {
    const fileBuffer = Buffer.from('test file content');
    const mockRequest = {
      headers: {
        'content-type': 'multipart/form-data; boundary=boundary',
      },
      files: [
        {
          fieldname: 'files',
          buffer: fileBuffer,
          mimetype: 'text/plain',
          originalname: 'test.txt',
        },
      ],
      body: {},
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const mockNext: CallHandler = {
      handle: () => of(null),
    };

    (interceptor as any).multipartInterceptor = {
      intercept: (context: any, next: any) => {
        return next.handle();
      },
    };

    const obs = await interceptor.intercept(mockContext, mockNext);
    await lastValueFrom(obs);

    expect((mockRequest as any).body.file).toBeDefined();
    expect((mockRequest as any).body.file.filename).toBe('test.txt');
  });

  it('should handle raw body request', async () => {
    const fileBuffer = Buffer.from('raw file content');
    const mockRequest = new Readable();
    (mockRequest as any).headers = {
      'content-type': 'application/octet-stream',
    };
    mockRequest.push(fileBuffer);
    mockRequest.push(null);
    (mockRequest as any).body = {};

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const mockNext: CallHandler = {
      handle: () => of(null),
    };

    const obs = await interceptor.intercept(mockContext, mockNext);
    await lastValueFrom(obs);

    expect((mockRequest as any).body.file).toBeDefined();
    expect((mockRequest as any).body.file.mimetype).toBe(
      'application/octet-stream',
    );
    expect((mockRequest as any).body.file.data).toBe(
      fileBuffer.toString('base64'),
    );
  });

  it('should ignore JSON requests', async () => {
    const mockRequest = {
      headers: {
        'content-type': 'application/json',
      },
      body: { some: 'json' },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as unknown as ExecutionContext;

    const mockNext: CallHandler = {
      handle: () => of(null),
    };

    const obs = await interceptor.intercept(mockContext, mockNext);
    await lastValueFrom(obs);

    expect((mockRequest as any).body.file).toBeUndefined();
  });
});

