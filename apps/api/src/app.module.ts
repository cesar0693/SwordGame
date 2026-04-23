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
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
