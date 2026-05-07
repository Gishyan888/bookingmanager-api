import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { SeedService } from './seed/seed.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

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
