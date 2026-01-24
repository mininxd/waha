import { Test, TestingModule } from '@nestjs/testing';
import { SessionManagerCore } from './manager.core';
import { WhatsappConfigService } from '../config.service';
import { EngineConfigService } from './config/EngineConfigService';
import { WebJSEngineConfigService } from './config/WebJSEngineConfigService';
import { GowsEngineConfigService } from './config/GowsEngineConfigService';
import { AppsService } from '@waha/apps/app_sdk/services/IAppsService';
import { MediaStorageFactory } from './media/MediaStorageFactory';
import { PinoLogger } from 'nestjs-pino';
import { WAHAEngine } from '../structures/enums.dto';
import { LocalSessionConfigRepository } from './storage/LocalSessionConfigRepository';

jest.mock('./storage/LocalSessionConfigRepository');
jest.mock('./storage/LocalStoreCore');
jest.mock('./storage/LocalSessionAuthRepository');
jest.mock('@adiwajshing/baileys', () => ({}));
jest.mock('whatsapp-web.js', () => ({
    Client: class {},
    AuthStrategy: class {},
    LocalAuth: class {},
}));
jest.mock('@waha/core/engines/webjs/session.webjs.core');
jest.mock('@waha/core/engines/noweb/session.noweb.core');
jest.mock('@waha/core/engines/gows/session.gows.core');

describe('SessionManagerCore', () => {
  let service: SessionManagerCore;
  let sessionConfigRepositoryMock: any;

  beforeEach(async () => {
    sessionConfigRepositoryMock = {
      saveConfig: jest.fn(),
      getConfig: jest.fn(),
      deleteConfig: jest.fn(),
    };
    (LocalSessionConfigRepository as unknown as jest.Mock).mockImplementation(() => sessionConfigRepositoryMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagerCore,
        { provide: WhatsappConfigService, useValue: { getWebhookConfig: () => null, getIgnoreChatsConfig: () => null } },
        { provide: EngineConfigService, useValue: { getDefaultEngineName: () => WAHAEngine.WEBJS, shouldPrintQR: false } },
        { provide: WebJSEngineConfigService, useValue: {} },
        { provide: GowsEngineConfigService, useValue: {} },
        { provide: PinoLogger, useValue: { logger: { child: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), level: 'info' }) }, setContext: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() } },
        { provide: MediaStorageFactory, useValue: { build: () => ({ purge: jest.fn(), init: jest.fn() }) } },
        { provide: AppsService, useValue: { migrate: jest.fn(), removeBySession: jest.fn(), beforeSessionStart: jest.fn(), afterSessionStart: jest.fn() } },
      ],
    }).compile();

    service = module.get<SessionManagerCore>(SessionManagerCore);
  });

  it('should save config on upsert', async () => {
    const config: any = { metadata: { id: '1' } };
    await service.upsert('default', config);
    
    // This expects the service to use sessionConfigRepository, which it doesn't yet.
    // So this test should fail if sessionConfigRepository is not initialized/used.
    // Note: If sessionConfigRepository is not initialized in service, 
    // trying to access it might throw error or calling method on undefined.
    // But since I'm checking if the mock was called, and the service doesn't even have the property initialized or calls it,
    // it will just expect call count 0 to be 1.
    
    expect(sessionConfigRepositoryMock.saveConfig).toHaveBeenCalledWith('default', config);
  });
  
  it('should delete config on delete', async () => {
      await service.delete('default');
      expect(sessionConfigRepositoryMock.deleteConfig).toHaveBeenCalledWith('default');
  });
});

