import { Module, forwardRef } from '@nestjs/common';
import { ResourcesModule } from '../resources/resources.module';
import { CompanionsModule } from '../companions/companions.module';
import { HeroesController } from './heroes.controller';
import { HeroesService } from './heroes.service';

@Module({
  imports: [ResourcesModule, forwardRef(() => CompanionsModule)],
  controllers: [HeroesController],
  providers: [HeroesService],
  exports: [HeroesService],
})
export class HeroesModule {}
