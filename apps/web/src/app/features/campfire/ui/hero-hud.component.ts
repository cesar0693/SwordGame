import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Hero } from '@swordgame/shared';

@Component({
  selector: 'sg-hero-hud',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        position: fixed;
        top: 0.75rem;
        left: 0.75rem;
        z-index: 10;
        display: block;
      }

      .card {
        min-width: 240px;
        background: linear-gradient(180deg, rgba(22, 14, 8, 0.85), rgba(14, 9, 5, 0.85));
        border: 1px solid #5a3e1f;
        border-radius: 10px;
        padding: 0.6rem 0.8rem;
        color: var(--fg);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(2px);
      }

      .row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
      .name { font-weight: 700; }
      .sub  { color: var(--fg-muted); font-size: 0.8rem; }

      .xp {
        margin-top: 0.5rem;
        height: 8px;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid #3a2a18;
        border-radius: 999px;
        overflow: hidden;
      }
      .xp > div {
        height: 100%;
        background: linear-gradient(90deg, #ff8a3d, #ffd28a);
        transition: width 0.3s ease;
      }
      .xp-label { font-size: 0.72rem; color: var(--fg-muted); margin-top: 0.2rem; }
    `,
  ],
  template: `
    <div class="card">
      <div class="row">
        <span class="name">{{ hero().name }}</span>
        <span class="sub">Niv. {{ hero().level }}</span>
      </div>
      <div class="row">
        <span class="sub">{{ className() }}</span>
        <span class="sub">{{ hero().stats.hp }} PV · {{ hero().stats.mp }} PM</span>
      </div>
      <div class="xp"><div [style.width.%]="xpPct()"></div></div>
      <div class="xp-label">XP {{ hero().xp }} / {{ hero().xpToNext }}</div>
    </div>
  `,
})
export class HeroHudComponent {
  readonly hero = input.required<Hero>();

  protected readonly xpPct = computed(() => {
    const h = this.hero();
    if (h.xpToNext <= 0) return 0;
    return Math.min(100, Math.max(0, (h.xp / h.xpToNext) * 100));
  });

  protected className(): string {
    switch (this.hero().heroClass) {
      case 'WARRIOR': return 'Guerrier';
      case 'MAGE':    return 'Mage';
      case 'RANGER':  return 'Rôdeur';
    }
  }
}
