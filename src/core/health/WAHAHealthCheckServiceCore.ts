import { Injectable } from '@nestjs/common';
import { HealthCheckResult } from '@nestjs/terminus';

import { WAHAHealthCheckService } from '../abc/WAHAHealthCheckService';

@Injectable()
export class WAHAHealthCheckServiceCore extends WAHAHealthCheckService {
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }
}
