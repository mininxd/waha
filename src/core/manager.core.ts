import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AppsService,
  IAppsService,
} from '@waha/apps/app_sdk/services/IAppsService';
import { EngineBootstrap } from '@waha/core/abc/EngineBootstrap';
import { GowsEngineConfigService } from '@waha/core/config/GowsEngineConfigService';
import { WebJSEngineConfigService } from '@waha/core/config/WebJSEngineConfigService';
import { WhatsappSessionGoWSCore } from '@waha/core/engines/gows/session.gows.core';
import { WebhookConductor } from '@waha/core/integrations/webhooks/WebhookConductor';
import { MediaStorageFactory } from '@waha/core/media/MediaStorageFactory';
import { getPinoLogLevel, LoggerBuilder } from '@waha/utils/logging';
import { promiseTimeout, sleep } from '@waha/utils/promiseTimeout';
import { PinoLogger } from 'nestjs-pino';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { WhatsappConfigService } from '../config.service';
import {
  WAHAEngine,
  WAHAEvents,
  WAHASessionStatus,
} from '../structures/enums.dto';
import {
  ProxyConfig,
  SessionConfig,
  SessionDetailedInfo,
  SessionDTO,
  SessionInfo,
} from '../structures/sessions.dto';
import { WebhookConfig } from '../structures/webhooks.config.dto';
import { populateSessionInfo, SessionManager } from './abc/manager.abc';
import { SessionParams, WhatsappSession } from './abc/session.abc';
import { EngineConfigService } from './config/EngineConfigService';
import { WhatsappSessionNoWebCore } from './engines/noweb/session.noweb.core';
import { WhatsappSessionWebJSCore } from './engines/webjs/session.webjs.core';
import { getProxyConfig } from './helpers.proxy';
import { MediaManager } from './media/MediaManager';
import { LocalSessionAuthRepository } from './storage/LocalSessionAuthRepository';
import { LocalStoreCore } from './storage/LocalStoreCore';

enum DefaultSessionStatus {
  REMOVED = undefined,
  STOPPED = null,
}

@Injectable()
export class SessionManagerCore extends SessionManager implements OnModuleInit {
  SESSION_STOP_TIMEOUT = 3000;

  private sessions: Map<string, WhatsappSession | DefaultSessionStatus> =
    new Map();
  private sessionConfigs: Map<string, SessionConfig> = new Map();
  DEFAULT = 'default';

  protected readonly EngineClass: typeof WhatsappSession;
  protected readonly engineBootstrap: EngineBootstrap;

  constructor(
    config: WhatsappConfigService,
    private engineConfigService: EngineConfigService,
    private webjsEngineConfigService: WebJSEngineConfigService,
    gowsConfigService: GowsEngineConfigService,
    log: PinoLogger,
    private mediaStorageFactory: MediaStorageFactory,
    @Inject(AppsService)
    appsService: IAppsService,
  ) {
    super(log, config, gowsConfigService, appsService);

    this.sessions.set(this.DEFAULT, DefaultSessionStatus.STOPPED);
    this.sessionConfigs.set(this.DEFAULT, null);

    const engineName = this.engineConfigService.getDefaultEngineName();
    this.EngineClass = this.getEngine(engineName);
    this.engineBootstrap = this.getEngineBootstrap(engineName);

    this.store = new LocalStoreCore(engineName.toLowerCase());
    this.sessionAuthRepository = new LocalSessionAuthRepository(this.store);
    this.clearStorage().catch((error) => {
      this.log.error({ error }, 'Error while clearing storage');
    });
  }

  protected getEngine(engine: WAHAEngine): typeof WhatsappSession {
    if (engine === WAHAEngine.WEBJS) {
      return WhatsappSessionWebJSCore;
    } else if (engine === WAHAEngine.NOWEB) {
      return WhatsappSessionNoWebCore;
    } else if (engine === WAHAEngine.GOWS) {
      return WhatsappSessionGoWSCore;
    } else {
      throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`);
    }
  }

  async beforeApplicationShutdown(signal?: string) {
    for (const [name, session] of this.sessions) {
      if (
        session &&
        session !== DefaultSessionStatus.STOPPED &&
        session !== DefaultSessionStatus.REMOVED
      ) {
        await this.stop(name, true);
      }
    }
    await this.engineBootstrap.shutdown();
  }

  async onApplicationBootstrap() {
    await this.engineBootstrap.bootstrap();
    this.startPredefinedSessions();
  }

  private async clearStorage() {
    const storage = await this.mediaStorageFactory.build(
      'all',
      this.log.logger.child({ name: 'Storage' }),
    );
    await storage.purge();
  }

  //
  // API Methods
  //
  async exists(name: string): Promise<boolean> {
    return this.sessions.get(name) !== DefaultSessionStatus.REMOVED;
  }

  isRunning(name: string): boolean {
    const session = this.sessions.get(name);
    return (
      session !== DefaultSessionStatus.STOPPED &&
      session !== DefaultSessionStatus.REMOVED &&
      !!session
    );
  }

  async upsert(name: string, config?: SessionConfig): Promise<void> {
    this.sessionConfigs.set(name, config);
  }

  async start(name: string): Promise<SessionDTO> {
    if (this.isRunning(name)) {
      throw new UnprocessableEntityException(
        `Session '${name}' is already started.`,
      );
    }
    this.log.info({ session: name }, `Starting session...`);
    const logger = this.log.logger.child({ session: name });

    const sessionConfigData = this.sessionConfigs.get(name);
    logger.level = getPinoLogLevel(sessionConfigData?.debug);
    const loggerBuilder: LoggerBuilder = logger;

    const storage = await this.mediaStorageFactory.build(
      name,
      loggerBuilder.child({ name: 'Storage' }),
    );
    await storage.init();
    const mediaManager = new MediaManager(
      storage,
      this.config.mimetypes,
      loggerBuilder.child({ name: 'MediaManager' }),
    );

    const webhook = new WebhookConductor(loggerBuilder);
    const proxyConfig = this.getProxyConfig(name);
    const sessionConfig: SessionParams = {
      name,
      mediaManager,
      loggerBuilder,
      printQR: this.engineConfigService.shouldPrintQR,
      sessionStore: this.store,
      proxyConfig: proxyConfig,
      sessionConfig: sessionConfigData,
      ignore: this.ignoreChatsConfig(sessionConfigData),
    };
    if (this.EngineClass === WhatsappSessionWebJSCore) {
      sessionConfig.engineConfig = this.webjsEngineConfigService.getConfig();
    } else if (this.EngineClass === WhatsappSessionGoWSCore) {
      sessionConfig.engineConfig = this.gowsConfigService.getConfig();
    }
    await this.sessionAuthRepository.init(name);
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions.set(name, session);

    // configure webhooks
    const webhooks = this.getWebhooks(sessionConfigData);
    webhook.configure(session, webhooks);

    // Apps
    try {
      await this.appsService.beforeSessionStart(session, this.store);
    } catch (e) {
      logger.error(`Apps Error: ${e}`);
      session.status = WAHASessionStatus.FAILED;
    }

    // start session
    if (session.status !== WAHASessionStatus.FAILED) {
      await session.start();
      logger.info('Session has been started.');
      // Apps
      await this.appsService.afterSessionStart(session, this.store);
    }

    // Apps
    await this.appsService.afterSessionStart(session, this.store);

    return {
      name: session.name,
      status: session.status,
      config: session.sessionConfig,
    };
  }

  getSessionEvent(sessionName: string, event: WAHAEvents): Observable<any> {
    const session = this.sessions.get(sessionName);
    if (
      session &&
      session !== DefaultSessionStatus.STOPPED &&
      session !== DefaultSessionStatus.REMOVED
    ) {
      return (session as WhatsappSession)
        .getEventObservable(event)
        .pipe(
          map(populateSessionInfo(event, session as WhatsappSession)),
        );
    }
    return of();
  }

  async stop(name: string, silent: boolean): Promise<void> {
    if (!this.isRunning(name)) {
      this.log.debug({ session: name }, `Session is not running.`);
      return;
    }

    this.log.info({ session: name }, `Stopping session...`);
    try {
      const session = this.getSession(name);
      await session.stop();
    } catch (err) {
      this.log.warn(`Error while stopping session '${name}'`);
      if (!silent) {
        throw err;
      }
    }
    this.log.info({ session: name }, `Session has been stopped.`);
    this.sessions.set(name, DefaultSessionStatus.STOPPED);
    await sleep(this.SESSION_STOP_TIMEOUT);
  }

  async unpair(name: string) {
    const session = this.sessions.get(name);
    if (
      !session ||
      session === DefaultSessionStatus.STOPPED ||
      session === DefaultSessionStatus.REMOVED
    ) {
      return;
    }
    const whatsappSession = session as WhatsappSession;

    this.log.info({ session: name }, 'Unpairing the device from account...');
    await whatsappSession.unpair().catch((err) => {
      this.log.warn(`Error while unpairing from device: ${err}`);
    });
    await sleep(1000);
  }

  async logout(name: string): Promise<void> {
    await this.sessionAuthRepository.clean(name);
  }

  async delete(name: string): Promise<void> {
    await this.appsService.removeBySession(this, name);
    this.sessions.delete(name);
    this.sessionConfigs.delete(name);
  }

  /**
   * Combine per session and global webhooks
   */
  private getWebhooks(sessionConfig?: SessionConfig) {
    let webhooks: WebhookConfig[] = [];
    if (sessionConfig?.webhooks) {
      webhooks = webhooks.concat(sessionConfig.webhooks);
    }
    const globalWebhookConfig = this.config.getWebhookConfig();
    if (globalWebhookConfig) {
      webhooks.push(globalWebhookConfig);
    }
    return webhooks;
  }

  /**
   * Get either session's or global proxy if defined
   */
  protected getProxyConfig(name: string): ProxyConfig | undefined {
    const sessionConfig = this.sessionConfigs.get(name);
    if (sessionConfig?.proxy) {
      return sessionConfig.proxy;
    }
    const session = this.sessions.get(name);
    if (
      session === undefined ||
      session === DefaultSessionStatus.STOPPED ||
      session === DefaultSessionStatus.REMOVED
    ) {
      return undefined;
    }

    // Now session is WhatsappSession
    const activeSessions: Record<string, WhatsappSession> = {};
    for (const [key, value] of this.sessions) {
      if (
        value !== DefaultSessionStatus.STOPPED &&
        value !== DefaultSessionStatus.REMOVED
      ) {
        activeSessions[key] = value as WhatsappSession;
      }
    }
    return getProxyConfig(this.config, activeSessions, name);
  }

  getSession(name: string): WhatsappSession {
    const session = this.sessions.get(name);
    if (
      !session ||
      session === DefaultSessionStatus.STOPPED ||
      session === DefaultSessionStatus.REMOVED
    ) {
      throw new NotFoundException(
        `We didn't find a session with name '${name}'.\n` +
          `Please start it first by using POST /api/sessions/${name}/start request`,
      );
    }
    return session as WhatsappSession;
  }

  async getSessions(all: boolean): Promise<SessionInfo[]> {
    const result: SessionInfo[] = [];
    for (const [name, session] of this.sessions) {
      if (session === DefaultSessionStatus.REMOVED || session === undefined) {
        continue;
      }
      if (session === DefaultSessionStatus.STOPPED) {
        if (all) {
          result.push({
            name: name,
            status: WAHASessionStatus.STOPPED,
            config: this.sessionConfigs.get(name),
            me: null,
            presence: null,
            timestamps: {
              activity: null,
            },
          });
        }
        continue;
      }

      const s = session as WhatsappSession;
      const me = s?.getSessionMeInfo();
      result.push({
        name: s.name,
        status: s.status,
        config: s.sessionConfig,
        me: me,
        presence: s.presence,
        timestamps: {
          activity: s?.getLastActivityTimestamp(),
        },
      });
    }
    return result;
  }

  private async fetchEngineInfo(session: WhatsappSession) {
    // Get engine info
    let engineInfo = {};
    if (session) {
      try {
        engineInfo = await promiseTimeout(1000, session.getEngineInfo());
      } catch (error) {
        this.log.debug(
          { session: session.name, error: `${error}` },
          'Can not get engine info',
        );
      }
    }
    const engine = {
      engine: session?.engine,
      ...engineInfo,
    };
    return engine;
  }

  async getSessionInfo(name: string): Promise<SessionDetailedInfo | null> {
    const sessionStatus = this.sessions.get(name);

    if (sessionStatus === DefaultSessionStatus.STOPPED) {
      return {
        name: name,
        status: WAHASessionStatus.STOPPED,
        config: this.sessionConfigs.get(name),
        me: null,
        presence: null,
        timestamps: {
          activity: null,
        },
        engine: {},
      };
    }
    if (
      sessionStatus === DefaultSessionStatus.REMOVED ||
      sessionStatus === undefined
    ) {
      return null;
    }

    const session = sessionStatus as WhatsappSession;
    const me = session?.getSessionMeInfo();
    const engine = await this.fetchEngineInfo(session);
    return {
      name: session.name,
      status: session.status,
      config: session.sessionConfig,
      me: me,
      presence: session.presence,
      timestamps: {
        activity: session?.getLastActivityTimestamp(),
      },
      engine: engine,
    };
  }

  async onModuleInit() {
    await this.init();
  }

  async init() {
    await this.store.init();
    const knex = this.store.getWAHADatabase();
    await this.appsService.migrate(knex);
  }
}
