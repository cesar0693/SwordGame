import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HeroesModule } from './heroes/heroes.module';
import { ResourcesModule } from './resources/resources.module';
import { CompanionsModule } from './companions/companions.module';
import { ItemsModule } from './items/items.module';
import { MarketModule } from './market/market.module';
import { DailyModule } from './daily/daily.module';
import { MissionsModule } from './missions/missions.module';
import { ForgeModule } from './forge/forge.module';
import { SpellsModule } from './spells/spells.module';
import { PvpModule } from './pvp/pvp.module';
import { QuestsModule } from './quests/quests.module';
import { MinigamesModule } from './minigames/minigames.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      // Default per-IP bucket: 60 requests / min. Endpoints that need
      // tighter limits decorate with @Throttle locally.
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    HeroesModule,
    ResourcesModule,
    CompanionsModule,
    ItemsModule,
    MarketModule,
    DailyModule,
    MissionsModule,
    ForgeModule,
    SpellsModule,
    PvpModule,
    QuestsModule,
    MinigamesModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  controllers: [HealthController],
})
export class AppModule {}
