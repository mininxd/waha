import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { JOB_CONCURRENCY } from '@waha/apps/app_sdk/constants';
import { ILogger } from '@waha/apps/app_sdk/ILogger';
import { QueueName } from '@waha/apps/chatwoot/consumers/QueueName';
import { DIContainer } from '@waha/apps/chatwoot/di/DIContainer';
import { SessionManager } from '@waha/core/abc/manager.abc';
import { CHANGELOG_URL, SUPPORT_US_URL } from '@waha/core/constants';
import { RMutexService } from '@waha/modules/rmutex/rmutex.service';
import { VERSION, WAHAVersion } from '@waha/version';
import axios from 'axios';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

import { ChatWootScheduledConsumer } from './base';
import { TKey } from '@waha/apps/chatwoot/i18n/templates';

/**
 * Scheduled consumer for version checking
 * Periodically checks for new versions and notifies if updates are available
 */
@Processor(QueueName.SCHEDULED_CHECK_VERSION, { concurrency: JOB_CONCURRENCY })
export class CheckVersionConsumer extends ChatWootScheduledConsumer {
  constructor(manager: SessionManager, log: PinoLogger, rmutex: RMutexService) {
    super(manager, log, rmutex, CheckVersionConsumer.name);
  }

  protected ErrorHeaderKey(): TKey {
    return TKey.JOB_SCHEDULED_ERROR_HEADER;
  }

  /**
   * Process the version check job
   * Checks for new versions and notifies if updates are available
   */
  protected async Process(container: DIContainer, job: Job): Promise<any> {
    await this.CheckWAHACoreVersion(container);
    await this.CheckNewVersionAvailable(container);
  }

  private async CheckWAHACoreVersion(container: DIContainer) {
    const logger = container.Logger();
    const locale = container.Locale();
    const conversation = await container
      .ContactConversationService()
      .InboxNotifications();
    // If using the CORE version, send a message encouraging support
    if (VERSION.tier !== WAHAVersion.CORE) {
      logger.info('WAHA is not using the CORE version');
      return;
    }
    logger.info('WAHA is using the CORE version');
    const supportMessage = locale.key(TKey.WAHA_CORE_VERSION_USED).render({
      supportUrl: SUPPORT_US_URL,
    });
    await conversation.incoming(supportMessage);
  }

  private async CheckNewVersionAvailable(container: DIContainer) {
    const logger = container.Logger();
    logger.info('Processing version check job');
    const currentVersion = VERSION.version;
    logger.info(`Current WAHA version: ${currentVersion}`);
    const latestVersion = await this.fetchLatestVersion(logger);
    const isNewVersionAvailable = currentVersion !== latestVersion;
    if (!isNewVersionAvailable) {
      logger.info('WAHA is up to date');
      return;
    }

    logger.info(
      `New version available: ${latestVersion} (current: ${currentVersion})`,
    );

    // Send a message to Chatwoot conversation about a new version
    const locale = container.Locale();
    const message = locale.key(TKey.WAHA_NEW_VERSION_AVAILABLE).render({
      currentVersion: currentVersion,
      newVersion: latestVersion,
      changelogUrl: CHANGELOG_URL,
    });
    const conversation = await container
      .ContactConversationService()
      .InboxNotifications();
    await conversation.incoming(message);
  }

  private async fetchLatestVersion(logger: ILogger): Promise<string> {
    const response = await axios.get(
      'https://api.github.com/repos/devlikeapro/waha/releases/latest',
    );
    const latestVersion = response.data.name;
    logger.info(`Latest WAHA version: ${latestVersion}`);
    return latestVersion;
  }
}
