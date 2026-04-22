import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Animated campfire placeholder.
 * Layered SVG flames with staggered CSS keyframes → flicker.
 * Replace the inline SVG with a real sprite-sheet later:
 *  - swap the <svg> block for an <img> pointing at the sheet
 *  - use background-position + `steps(N)` animation, same container size
 */
@Component({
  selector: 'sg-fire-sprite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        width: 180px;
        height: 200px;
        pointer-events: none;
        --glow: #ff9a3c;
      }

      .halo {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 62%, rgba(255, 170, 70, 0.55) 0%, rgba(255, 120, 40, 0.25) 25%, transparent 60%);
        filter: blur(4px);
        animation: halo 2.2s ease-in-out infinite;
      }

      .stage {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: end center;
      }

      svg.logs { position: absolute; bottom: 4px; width: 160px; }

      svg.flame {
        position: absolute;
        bottom: 24px;
        transform-origin: 50% 100%;
        will-change: transform, opacity;
        filter: drop-shadow(0 0 8px rgba(255, 130, 50, 0.45));
      }
      svg.flame.outer { width: 110px; animation: flicker-outer 0.35s ease-in-out infinite alternate; }
      svg.flame.mid   { width:  80px; animation: flicker-mid   0.27s ease-in-out infinite alternate; }
      svg.flame.core  { width:  50px; animation: flicker-core  0.19s ease-in-out infinite alternate; }

      .spark {
        position: absolute;
        width: 3px; height: 3px; border-radius: 50%;
        background: #ffd28a;
        box-shadow: 0 0 6px 1px rgba(255, 200, 120, 0.9);
        opacity: 0;
      }
      .spark.s1 { left: 48%; bottom: 60%; animation: spark 2.4s ease-in 0s infinite; }
      .spark.s2 { left: 55%; bottom: 55%; animation: spark 2.9s ease-in 0.7s infinite; }
      .spark.s3 { left: 42%; bottom: 65%; animation: spark 3.4s ease-in 1.4s infinite; }

      @keyframes halo {
        0%, 100% { opacity: 0.85; transform: scale(1); }
        50%      { opacity: 1;    transform: scale(1.04); }
      }
      @keyframes flicker-outer {
        0%   { transform: translateX(-50%) scale(1.00, 1.00) skewX(-1deg); opacity: 0.90; }
        100% { transform: translateX(-50%) scale(1.06, 0.94) skewX( 2deg); opacity: 1.00; }
      }
      @keyframes flicker-mid {
        0%   { transform: translateX(-50%) scale(0.98, 1.02) skewX( 1deg); opacity: 0.95; }
        100% { transform: translateX(-50%) scale(1.04, 0.96) skewX(-2deg); opacity: 1.00; }
      }
      @keyframes flicker-core {
        0%   { transform: translateX(-50%) scale(1.00, 1.00); opacity: 1.00; }
        100% { transform: translateX(-50%) scale(1.08, 0.92); opacity: 0.90; }
      }
      @keyframes spark {
        0%   { opacity: 0; transform: translate(0, 0) scale(1); }
        10%  { opacity: 1; }
        100% { opacity: 0; transform: translate(10px, -140px) scale(0.4); }
      }

      .flame.outer, .flame.mid, .flame.core { left: 50%; }
    `,
  ],
  template: `
    <div class="halo"></div>
    <div class="stage">
      <!-- Logs (base) -->
      <svg class="logs" viewBox="0 0 160 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g>
          <ellipse cx="55" cy="24" rx="55" ry="10" fill="#3a2414" transform="rotate(-12 55 24)"/>
          <ellipse cx="105" cy="26" rx="55" ry="10" fill="#4a2e18" transform="rotate(10 105 26)"/>
          <ellipse cx="18"  cy="22" rx="8"  ry="5"  fill="#8a5a2a"/>
          <ellipse cx="140" cy="24" rx="8"  ry="5"  fill="#8a5a2a"/>
          <path d="M40 26 q6 -4 12 0" stroke="#2a1708" stroke-width="1" fill="none"/>
          <path d="M90 28 q6 -4 12 0" stroke="#2a1708" stroke-width="1" fill="none"/>
          <!-- ember glow -->
          <circle cx="80" cy="30" r="4" fill="#ffb35a"/>
          <circle cx="70" cy="32" r="2.5" fill="#ff7a2a"/>
          <circle cx="90" cy="33" r="2" fill="#ff5a20"/>
        </g>
      </svg>

      <!-- Outer flame (dark orange) -->
      <svg class="flame outer" viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M50 158
                 C 14 140, 6 100, 26 70
                 C 22 92, 40 98, 38 76
                 C 44 60, 36 42, 54 22
                 C 52 46, 70 52, 60 76
                 C 80 66, 92 96, 86 122
                 C 82 142, 68 152, 50 158 Z"
              fill="#f0792a"/>
      </svg>

      <!-- Mid flame (bright orange) -->
      <svg class="flame mid" viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M40 138
                 C 14 122, 10 88, 26 62
                 C 24 80, 36 82, 34 64
                 C 40 50, 34 32, 48 14
                 C 46 36, 58 42, 52 66
                 C 68 58, 74 88, 66 108
                 C 62 126, 54 134, 40 138 Z"
              fill="#ffb84d"/>
      </svg>

      <!-- Core flame (yellow) -->
      <svg class="flame core" viewBox="0 0 60 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M30 108
                 C 12 96, 10 70, 22 50
                 C 22 62, 30 64, 28 52
                 C 32 40, 28 28, 38 14
                 C 36 30, 44 36, 40 52
                 C 50 48, 52 70, 46 86
                 C 42 100, 38 106, 30 108 Z"
              fill="#fff2a6"/>
      </svg>

      <div class="spark s1"></div>
      <div class="spark s2"></div>
      <div class="spark s3"></div>
    </div>
  `,
})
export class FireSpriteComponent {}
