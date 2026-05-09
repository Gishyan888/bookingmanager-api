import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { AuthOtp } from '../auth/entities/auth-otp.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Room } from '../rooms/entities/room.entity';
import { User } from '../users/entities/user.entity';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const port = parseInt(process.env.DB_PORT ?? '3306', 10);
const isTsRuntime = __filename.endsWith('.ts');

export const typeOrmDataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port,
  username: process.env.DB_USERNAME ?? 'bookingmanager',
  password: process.env.DB_PASSWORD ?? 'bookingmanager',
  database: process.env.DB_DATABASE ?? 'bookingmanager',
  charset: 'utf8mb4',
  entities: [User, Hotel, Room, Customer, Booking, Notification, AuthOtp],
  migrations: isTsRuntime ? ['src/migrations/*.ts'] : ['dist/migrations/*.js'],
  synchronize: false,
};

export default new DataSource(typeOrmDataSourceOptions);
