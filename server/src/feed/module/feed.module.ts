import { Module } from '@nestjs/common';
import { FeedController } from '../controller/feed.controller';
import { FeedService } from '../service/feed.service';
import {
  FeedRepository,
  FeedViewRepository,
} from '../repository/feed.repository';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [ScheduleModule.forRoot(), EventEmitterModule.forRoot()],
  controllers: [FeedController],
  providers: [FeedService, FeedRepository, FeedViewRepository],
})
export class FeedModule {}