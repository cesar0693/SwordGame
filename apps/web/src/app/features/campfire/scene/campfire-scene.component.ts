import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { HeroClass } from '@swordgame/shared';
import { FireSpriteComponent } from './fire-sprite.component';
import { HeroSpriteComponent } from './hero-sprite.component';

/**
 * Full-viewport scene: forest + sky background, campfire centered,
 * hero standing next to the fire, looking at it.
 */
@Component({
  selector: 'sg-campfire-scene',
  standalone: true,
  imports: [FireSpriteComponent, HeroSpriteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        background:
          /* warm firelight bloom over the bg */
          radial-gradient(ellipse 600px 400px at 50% 72%, rgba(255, 130, 40, 0.18) 0%, transparent 60%),
          url('/assets/placeholders/forest-bg.svg') center/cover no-repeat;
      }

      /* evening tint as you stare at the fire */
      .dusk {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at 50% 72%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.45) 90%);
        pointer-events: none;
      }

      .stage {
        position: absolute;
        left: 50%;
        bottom: 14%;
        transform: translateX(-50%);
        display: grid;
        grid-template-columns: auto auto;
        align-items: end;
        column-gap: 12px;
        pointer-events: none;
      }

      sg-hero-sprite { transform: translateY(6px); }
      sg-fire-sprite { transform: translateY(0); }

      /* Subtle firelight breathing on the hero side */
      .hero-lit {
        filter: drop-shadow(0 0 18px rgba(255, 150, 60, 0.25));
        animation: hero-firelight 2.3s ease-in-out infinite;
      }
      @keyframes hero-firelight {
        0%, 100% { filter: drop-shadow(0 0 12px rgba(255, 150, 60, 0.18)); }
        50%      { filter: drop-shadow(0 0 22px rgba(255, 150, 60, 0.35)); }
      }
    `,
  ],
  template: `
    <div class="dusk"></div>
    <div class="stage">
      <!-- Hero is to the left, facing right toward the fire -->
      <div class="hero-lit">
        <sg-hero-sprite [heroClass]="heroClass()" face="right" />
      </div>
      <sg-fire-sprite />
    </div>
  `,
})
export class CampfireSceneComponent {
  readonly heroClass = input<HeroClass>('WARRIOR');
}
