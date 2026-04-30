import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppConfigService } from './shared/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin: any, callback: any) => {
      if (!origin) return callback(null, true);

      const allowed = [
        /^http:\/\/scalent-app\.test$/,
        /^http:\/\/([a-z0-9-]+\.)+scalent-app\.test$/,
        /^https:\/\/([a-z0-9-]+\.)*scalent\.id$/,
        /^http:\/\/localhost:\d+$/,
      ];

      callback(null, allowed.some(r => r.test(origin)) ? origin : false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'business-id'],
  });

  const config = app.get(AppConfigService);

  app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('E-Wallet Backend API')
    .setDescription('API documentation for multi-currency e-wallet backend system')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app as any, swaggerConfig);

  SwaggerModule.setup('api-docs', app as any, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(config.port);

  console.log(`🚀 Server running on http://localhost:${config.port}/api/v1`);
  console.log(`📚 Swagger docs running on http://localhost:${config.port}/api-docs`);
}

bootstrap();