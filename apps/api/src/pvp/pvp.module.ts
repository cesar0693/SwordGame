import { Module } from '@nestjs/common';
import { HeroesModule } from '../heroes/heroes.module';
import { ItemsModule } from '../items/items.module';
import { ResourcesModule } from '../resources/resources.module';
import { SpellsModule } from '../spells/spells.module';
import { QuestsModule } from '../quests/quests.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PvpController } from './pvp.controller';
import { PvpService } from './pvp.service';

@Module({
  imports: [
    HeroesModule,
    ItemsModule,
    ResourcesModule,
    SpellsModule,
    QuestsModule,
    NotificationsModule,
  ],
  controllers: [PvpController],
  providers: [PvpService],
  exports: [PvpService],
})
export class PvpModule {}
