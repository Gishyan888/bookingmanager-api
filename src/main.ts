import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

type OriginFn = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void;

/**
 * When `CORS_ORIGINS` is unset → reflect any origin (dev-friendly).
 * When set → only those origins, unless `CORS_ALLOW_LOCALHOST` allows
 * `http://localhost:*` and `http://127.0.0.1:*` (for Vite on :5173 hitting prod API).
 */
function resolveCorsOrigin(): boolean | string[] | OriginFn {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return true;

  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (!list.length) return true;

  const allowLocalhost =
    process.env.CORS_ALLOW_LOCALHOST === '1' ||
    process.env.CORS_ALLOW_LOCALHOST === 'true';

  if (!allowLocalhost) return list;

  const isLocalDevOrigin = (origin: string) =>
    /^http:\/\/localhost(?::\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin);

  const originFn: OriginFn = (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (list.includes(origin)) {
      callback(null, true);
      return;
    }
    if (isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };

  return originFn;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Explicit CORS avoids flaky preflight handling and makes allowed origins obvious in production.
  // Set CORS_ORIGINS=https://bookingmanager.online,https://www.bookingmanager.online (no trailing slashes).
  // Local Vite (http://localhost:5173) → prod API: add CORS_ALLOW_LOCALHOST=true on the API server.
  // If CORS_ORIGINS is unset, Nest reflects the request origin (same as old { cors: true }).
  // app.enableCors({
  //   origin: resolveCorsOrigin(),
  //   methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  //   allowedHeaders: [
  //     'Content-Type',
  //     'Authorization',
  //     'Accept',
  //     'X-Requested-With',
  //   ],
  //   credentials: true,
  //   maxAge: 86_400,
  // });
  app.enableCors({
    origin: [
      'https://bookingmanager.online',
      'https://www.bookingmanager.online',
    ],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: false,
    maxAge: 86400,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Booking Manager API')
    .setDescription(
      'Hotel management platform — Admin / Owner / Manager dashboards.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Optional first admin from env when `users` is empty (see BOOTSTRAP_ADMIN_*).
  const seed = app.get(SeedService);
  await seed.run();

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);

  console.log(`🚀 API ready  →  http://localhost:${port}/api`);

  console.log(`📚 Swagger    →  http://localhost:${port}/api/docs`);
}
void bootstrap();
