import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Hero } from '@swordgame/shared';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-profile-panel',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.4rem 1.25rem;
      }
      .row {
        display: flex; justify-content: space-between;
        padding: 0.35rem 0;
        border-bottom: 1px dashed #3a2a18;
        font-size: 0.92rem;
      }
      .row span { color: var(--fg-muted); }
      .row b { color: var(--fg); }

      .xp { margin-top: 1rem; }
      .bar {
        height: 10px; background: rgba(0,0,0,0.5);
        border: 1px solid #3a2a18; border-radius: 999px; overflow: hidden;
      }
      .bar > div {
        height: 100%;
        background: linear-gradient(90deg, #ff8a3d, #ffd28a);
      }
      .xp-label { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--fg-muted); margin-top: 0.3rem; }

      .header-line {
        display: flex; align-items: baseline; justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .header-line .name { font-size: 1.2rem; font-weight: 700; }
      .header-line .cls  { color: var(--fg-muted); font-size: 0.9rem; }

      .points {
        margin-top: 0.75rem; padding: 0.6rem 0.75rem;
        background: #2a1b10; border: 1px solid #3a2a18; border-radius: 8px;
        color: var(--fg-muted); font-size: 0.9rem;
      }
    `,
  ],
  template: `
    <sg-panel title="Profil du héros" (closed)="closed.emit()">
      <div class="header-line">
        <span class="name">{{ hero().name }}</span>
        <span class="cls">{{ className() }} · Niveau {{ hero().level }}</span>
      </div>

      <div class="grid">
        <div class="row"><span>Points de vie</span><b>{{ hero().stats.hp }}</b></div>
        <div class="row"><span>Points de mana</span><b>{{ hero().stats.mp }}</b></div>
        <div class="row"><span>Attaque</span><b>{{ hero().stats.attack }}</b></div>
        <div class="row"><span>Défense</span><b>{{ hero().stats.defense }}</b></div>
        <div class="row"><span>Vitesse</span><b>{{ hero().stats.speed }}</b></div>
        <div class="row"><span>Critique</span><b>{{ pct(hero().stats.critChance) }}</b></div>
        <div class="row"><span>Échec critique</span><b>{{ pct(hero().stats.critFailChance) }}</b></div>
        <div class="row"><span>Esquive</span><b>{{ pct(hero().stats.dodgeChance) }}</b></div>
      </div>

      <div class="xp">
        <div class="bar"><div [style.width.%]="xpPct()"></div></div>
        <div class="xp-label">
          <span>XP</span>
          <span>{{ hero().xp }} / {{ hero().xpToNext }}</span>
        </div>
      </div>

      <div class="points">
        Points disponibles : <b>{{ hero().unallocatedPoints }}</b>
        <br /><em>Allocation dispo après la Phase 4 (level-up via missions).</em>
      </div>
    </sg-panel>
  `,
})
export class ProfilePanelComponent {
  readonly hero = input.required<Hero>();
  readonly closed = output<void>();

  protected pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }

  protected xpPct(): number {
    const h = this.hero();
    if (h.xpToNext <= 0) return 0;
    return Math.min(100, Math.max(0, (h.xp / h.xpToNext) * 100));
  }

  protected className(): string {
    switch (this.hero().heroClass) {
      case 'WARRIOR': return 'Guerrier';
      case 'MAGE':    return 'Mage';
      case 'RANGER':  return 'Rôdeur';
    }
  }
}
