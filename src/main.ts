import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

function parseCorsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return true;
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return list.length ? list : true;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Explicit CORS avoids flaky preflight handling and makes allowed origins obvious in production.
  // Set CORS_ORIGINS=https://bookingmanager.online,https://www.bookingmanager.online (no trailing slashes).
  // If unset, Nest reflects the request origin (same as previous { cors: true } behavior).
  app.enableCors({
    origin: parseCorsOrigins(),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: true,
    maxAge: 86_400,
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
