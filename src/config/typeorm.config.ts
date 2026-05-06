import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function typeOrmConfigFactory(
  config: ConfigService,
): TypeOrmModuleOptions {
  const port = parseInt(config.get<string>('DB_PORT', '3306'), 10);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST', 'localhost'),
    port,
    username: config.get<string>('DB_USERNAME', 'bookingmanager'),
    password: config.get<string>('DB_PASSWORD', 'bookingmanager'),
    database: config.get<string>('DB_DATABASE', 'bookingmanager'),
    autoLoadEntities: true,
    synchronize: nodeEnv !== 'production',
    logging: nodeEnv === 'development',
  };
}
