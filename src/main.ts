import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { abortOnError: false });
    
    // Configure global URI-based versioning (/v1/..., /v2/...)
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1', // Routes without explicit @Version() resolve to v1
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT') || 3000;
    const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED') !== 'false';

    if (swaggerEnabled) {
      const config = new DocumentBuilder()
        .setTitle('LogiQuest API')
        .setDescription(
          `REST API for the LogiQuest puzzle platform.\n\n` +
          `## API Versioning\n` +
          `Endpoints are versioned via URI paths (e.g., \`/v1/puzzles\`, \`/v2/puzzles\`):\n` +
          `- **v1 (Deprecated)** – Preserved for legacy clients. Deprecated routes include \`Deprecation\` headers.\n` +
          `- **v2 (Current)** – Active API contract for new client implementations.\n` +
          `- **Unversioned Requests** – Automatically fallback to \`v1\`.\n\n` +
          `## Authentication\n` +
          `Most endpoints require a JWT Bearer token obtained from \`POST /v1/auth/login\` or \`POST /v1/auth/register\`.\n` +
          `Pass it as: \`Authorization: Bearer <token>\`\n\n` +
          `## Roles\n` +
          `- **player** – default role for registered users\n` +
          `- **admin** – elevated role required for admin-only endpoints`,
        )
        .setVersion('2.0')
        .setContact('MindFlow Interactive', 'https://github.com/MindFlowInteractive/logiquest_api', '')
        .setLicense('ISC', '')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            name: 'Authorization',
            in: 'header',
            description: 'Enter your JWT access token',
          },
          'access-token',
        )
        .addTag('auth', 'Registration, login, and OAuth flows')
        .addTag('users', 'User profile management')
        .addTag('puzzles', 'Puzzle catalogue and submission workflow')
        .addTag('sessions', 'Gameplay sessions — start, submit, abandon')
        .addTag('replay', 'Session replay events and timeline')
        .addTag('hints', 'Hint reveal for an active session')
        .addTag('categories', 'Puzzle category management')
        .addTag('tags', 'Puzzle tag management')
        .addTag('achievements', 'Achievement catalogue and player progress')
        .addTag('leaderboard', 'Global and per-category score rankings')
        .addTag('analytics', 'Puzzle and player performance analytics')
        .addTag('notifications', 'In-app notifications for the authenticated user')
        .addTag('nft', 'NFT minting for unlocked achievements')
        .addTag('scoring', 'Player score summaries')
        .addTag('recommendations', 'Personalised puzzle recommendations')
        .addTag('admin', 'Admin-only user, session, and submission management')
        .addTag('admin/audit', 'Audit log access (admin only)')
        .addTag('admin/calibration', 'Automated difficulty calibration management (admin only)')
        .addTag('health', 'Liveness and readiness health probes')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
          tagsSorter: 'alpha',
          operationsSorter: 'alpha',
          docExpansion: 'none',
          filter: true,
          showRequestDuration: true,
        },
        customSiteTitle: 'LogiQuest API Docs',
      });

      console.log(`Swagger UI available at http://localhost:${port}/api/docs`);
    }

    await app.listen(port);
    console.log(`Server running on port ${port}`);
  } catch (error: any) {
    console.error('\n================================================================');
    console.error('FATAL ERROR: Database connection failed or startup error occurred!');
    console.error(error.message || error);
    console.error('================================================================\n');
    process.exit(1);
  }
}
bootstrap();