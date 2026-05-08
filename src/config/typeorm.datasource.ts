import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuthOtp } from '../auth/entities/auth-otp.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Room } from '../rooms/entities/room.entity';
import { User } from '../users/entities/user.entity';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const port = parseInt(process.env.DB_PORT ?? '3306', 10);

export const typeOrmDataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port,
  username: process.env.DB_USERNAME ?? 'bookingmanager',
  password: process.env.DB_PASSWORD ?? 'bookingmanager',
  database: process.env.DB_DATABASE ?? 'bookingmanager',
  entities: [User, Hotel, Room, Customer, Booking, AuthOtp, Notification],
  migrations: ['src/migrations/*.ts', 'dist/migrations/*.js'],
  synchronize: false,
};

export default new DataSource(typeOrmDataSourceOptions);
