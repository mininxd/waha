import { WhatsappSession } from './session.abc';

describe('WhatsappSession', () => {
  it('getBrowserArgsForPuppeteer includes DBus fix flags', () => {
    // The method doesn't use 'this', so we can call it directly on the prototype
    // or mock the context if needed (it calls getBrowserExecutablePath but that is not used in the return array)
    // Actually looking at the code, it returns a static array.

    const args = WhatsappSession.prototype.getBrowserArgsForPuppeteer.call({});

    expect(args).toContain('--disable-features=AudioServiceOutOfProcess');
    expect(args).toContain('--disable-gpu-sandbox');
    expect(args).toContain('--disable-accelerated-video-decode');
  });
});
