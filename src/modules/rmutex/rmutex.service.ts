import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectPinoLogger } from 'nestjs-pino';
import { Logger } from 'pino';

import { RMutexImpl } from './mutex';
import { RedisMutexClient } from './RedisMutexClient';
import { RMutex, RMutexClient, RMutexLocked } from './types';

@Injectable()
export class RMutexService {
  private readonly ttl: number;
  private readonly client: RMutexClient;

  constructor(
    private readonly redisService: RedisService,
    @InjectPinoLogger('RMutexService') private readonly logger: Logger,
    @Optional() ttl?: number,
  ) {
    const redis = this.redisService.getOrThrow(); // Get the default Redis instance
    this.ttl = ttl || 60_000;
    this.client = new RedisMutexClient(redis, this.logger);
  }

  /**
   * Creates a new RMutex instance for the given key
   * @param key The initial key for the mutex
   * @param ttl Time to live in milliseconds (optional, uses the default TTL if not provided)
   * @returns A new RMutex instance
   */
  get(key: string, ttl?: number): RMutex {
    ttl = ttl !== undefined ? ttl : this.ttl;
    return new RMutexImpl(this.client, key, ttl);
  }
}
