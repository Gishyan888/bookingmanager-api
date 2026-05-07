import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Hotel } from './entities/hotel.entity';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';

@Module({
  imports: [TypeOrmModule.forFeature([Hotel, User])],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService, TypeOrmModule],
})
export class HotelsModule {}
