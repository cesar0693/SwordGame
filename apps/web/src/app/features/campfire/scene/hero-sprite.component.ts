import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { HeroClass } from '@swordgame/shared';

/**
 * Hero placeholder sprite: stylized silhouette with subtle idle breathing.
 * Replace with a real sprite sheet by swapping the SVG for an <img>.
 * The component mirrors the character so it always faces the fire.
 */
@Component({
  selector: 'sg-hero-sprite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: inline-block;
        width: 120px;
        height: 200px;
        position: relative;
        pointer-events: none;
      }

      .hero {
        width: 100%;
        height: 100%;
        transform-origin: 50% 100%;
        animation: idle-breathe 3.6s ease-in-out infinite;
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.55));
      }

      :host([data-face='right']) .hero { transform: scaleX(-1); }
      :host([data-face='right']) .hero { animation-name: idle-breathe-mirrored; }

      @keyframes idle-breathe {
        0%, 100% { transform: scale(1, 1); }
        50%      { transform: scale(1.008, 0.992); }
      }
      @keyframes idle-breathe-mirrored {
        0%, 100% { transform: scaleX(-1) scale(1, 1); }
        50%      { transform: scaleX(-1) scale(1.008, 0.992); }
      }
    `,
  ],
  host: { '[attr.data-face]': 'face()' },
  template: `
    <svg
      class="hero"
      viewBox="0 0 120 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <!-- Shadow under feet -->
      <ellipse cx="60" cy="196" rx="36" ry="4" fill="rgba(0,0,0,0.4)"/>

      <!-- Legs -->
      <rect x="46" y="130" width="12" height="58" rx="4" [attr.fill]="legColor()"/>
      <rect x="62" y="130" width="12" height="58" rx="4" [attr.fill]="legColor()"/>

      <!-- Boots -->
      <rect x="44" y="184" width="16" height="10" rx="2" fill="#2a1b10"/>
      <rect x="60" y="184" width="16" height="10" rx="2" fill="#2a1b10"/>

      <!-- Torso / tunic -->
      <path d="M34 80 L86 80 L92 140 L28 140 Z" [attr.fill]="torsoColor()"/>
      <!-- Belt -->
      <rect x="28" y="132" width="64" height="8" fill="#2a1b10"/>
      <!-- Tunic V -->
      <path d="M50 80 L60 100 L70 80 Z" fill="rgba(0,0,0,0.25)"/>

      <!-- Arms (class-specific accessories hang here) -->
      <rect x="22" y="84" width="12" height="50" rx="5" [attr.fill]="torsoColor()"/>
      <rect x="86" y="84" width="12" height="50" rx="5" [attr.fill]="torsoColor()"/>

      <!-- Hands -->
      <circle cx="28" cy="138" r="7" fill="#e3b08a"/>
      <circle cx="92" cy="138" r="7" fill="#e3b08a"/>

      <!-- Neck -->
      <rect x="54" y="68" width="12" height="14" fill="#e3b08a"/>

      <!-- Head -->
      <circle cx="60" cy="54" r="20" fill="#e3b08a"/>
      <!-- Hair -->
      <path d="M40 52 Q40 32 60 32 Q80 32 80 52 L78 46 Q70 40 60 40 Q50 40 42 46 Z" fill="#3b2415"/>
      <!-- Eye + beard hint -->
      <circle cx="66" cy="54" r="1.6" fill="#1a120a"/>
      <path d="M52 62 Q60 68 68 62" stroke="#1a120a" stroke-width="1.2" fill="none"/>

      <!-- Class-specific prop -->
      @switch (heroClass()) {
        @case ('WARRIOR') {
          <!-- Sword planted at side -->
          <g>
            <rect x="14" y="90" width="4" height="70" fill="#d9d2c5"/>
            <rect x="10" y="86" width="12" height="6" fill="#6e4a24"/>
            <rect x="15" y="92" width="2" height="60" fill="#ffffff" opacity="0.35"/>
          </g>
        }
        @case ('MAGE') {
          <!-- Staff with glow orb -->
          <g>
            <rect x="14" y="60" width="4" height="100" fill="#4a2f18"/>
            <circle cx="16" cy="58" r="8" fill="#8ecbff"/>
            <circle cx="16" cy="58" r="4" fill="#ffffff" opacity="0.8"/>
          </g>
        }
        @case ('RANGER') {
          <!-- Short bow -->
          <g>
            <path d="M18 78 Q2 120 18 160" stroke="#6e4a24" stroke-width="4" fill="none"/>
            <line x1="18" y1="78" x2="18" y2="160" stroke="#d9d2c5" stroke-width="1.2"/>
          </g>
        }
      }
    </svg>
  `,
})
export class HeroSpriteComponent {
  readonly heroClass = input<HeroClass>('WARRIOR');
  /** 'left' => facing left, 'right' => facing right (sprite mirrored). */
  readonly face = input<'left' | 'right'>('right');

  protected torsoColor(): string {
    switch (this.heroClass()) {
      case 'WARRIOR':
        return '#5a3a22';
      case 'MAGE':
        return '#2b3e72';
      case 'RANGER':
        return '#2f5a2a';
    }
  }

  protected legColor(): string {
    switch (this.heroClass()) {
      case 'WARRIOR':
        return '#3a2815';
      case 'MAGE':
        return '#1f2b55';
      case 'RANGER':
        return '#223d20';
    }
  }
}
