import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  @Version(VERSION_NEUTRAL) // Accessible at root GET / without a version prefix
  getApiInfo() {
    return {
      name: 'logiquest_api',
      currentVersion: 'v2',
      supportedVersions: ['v1', 'v2'],
      deprecationNotice: {
        deprecatedVersion: 'v1',
        sunsetDate: '2026-12-31T23:59:59Z',
        recommendation: 'Migrate all requests to /v2/ before the sunset date.',
      },
    };
  }
}