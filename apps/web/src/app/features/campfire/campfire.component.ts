import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { HeroesService } from '../../core/heroes/heroes.service';
import { HeroCreationComponent } from './hero-creation.component';

@Component({
  selector: 'sg-campfire',
  standalone: true,
  imports: [HeroCreationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; min-height: 100dvh; }

      header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border);
        background: var(--bg-elev);
      }
      header .title { font-weight: 700; letter-spacing: 0.02em; }
      header .user { font-size: 0.9rem; color: var(--fg-muted); margin-right: 0.75rem; }

      main {
        max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem;
        display: grid; gap: 1.25rem;
        grid-template-columns: 1fr;
      }
      @media (min-width: 960px) {
        main { grid-template-columns: 320px 1fr; }
      }

      .hero-card { display: flex; flex-direction: column; gap: 0.75rem; }
      .portrait {
        width: 100%; aspect-ratio: 1/1;
        background: var(--bg-soft);
        border: 1px dashed var(--border);
        border-radius: var(--radius);
        display: grid; place-items: center;
        color: var(--fg-muted);
        font-size: 0.9rem;
      }
      .hero-name { font-size: 1.25rem; font-weight: 700; }
      .hero-class { color: var(--fg-muted); font-size: 0.85rem; }
      .stats { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0.4rem 0.8rem; }
      .stat { display: flex; justify-content: space-between; font-size: 0.9rem; }
      .stat b { color: var(--fg); }
      .stat span { color: var(--fg-muted); }

      .campfire-scene {
        position: relative;
        aspect-ratio: 16/9;
        border-radius: var(--radius);
        overflow: hidden;
        background:
          radial-gradient(ellipse at 50% 80%, #3a1f0a 0%, #140a05 65%),
          #0a0603;
        border: 1px solid var(--border);
        display: grid; place-items: center;
        color: var(--fg-muted);
      }
      .campfire-scene .hint {
        position: absolute; bottom: 0.6rem; left: 0.6rem; font-size: 0.8rem;
      }

      .actions {
        display: grid; gap: 0.6rem;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      }
      .action {
        padding: 0.8rem; border: 1px solid var(--border); border-radius: var(--radius);
        background: var(--bg-elev); color: var(--fg-muted); font-size: 0.9rem;
        cursor: not-allowed;
      }
      .action b { display: block; color: var(--fg); margin-bottom: 0.1rem; }
    `,
  ],
  template: `
    <header>
      <div class="title">SwordGame</div>
      <div>
        <span class="user">{{ auth.user()?.username }}</span>
        <button (click)="logout()">Déconnexion</button>
      </div>
    </header>

    <main>
      @if (loading()) {
        <div class="card">Chargement…</div>
      } @else if (!heroes.hero()) {
        <sg-hero-creation class="card" style="grid-column: 1 / -1" />
      } @else {
        <section class="card hero-card">
          <div class="portrait">[portrait placeholder]</div>
          <div>
            <div class="hero-name">{{ heroes.hero()!.name }}</div>
            <div class="hero-class">
              {{ heroes.hero()!.heroClass }} · Niv. {{ heroes.hero()!.level }}
            </div>
          </div>
          <div class="stats">
            <div class="stat"><span>PV</span><b>{{ heroes.hero()!.stats.hp }}</b></div>
            <div class="stat"><span>PM</span><b>{{ heroes.hero()!.stats.mp }}</b></div>
            <div class="stat"><span>ATQ</span><b>{{ heroes.hero()!.stats.attack }}</b></div>
            <div class="stat"><span>DEF</span><b>{{ heroes.hero()!.stats.defense }}</b></div>
            <div class="stat"><span>VIT</span><b>{{ heroes.hero()!.stats.speed }}</b></div>
            <div class="stat"><span>Crit %</span><b>{{ pct(heroes.hero()!.stats.critChance) }}</b></div>
            <div class="stat"><span>Échec crit %</span><b>{{ pct(heroes.hero()!.stats.critFailChance) }}</b></div>
            <div class="stat"><span>Esquive %</span><b>{{ pct(heroes.hero()!.stats.dodgeChance) }}</b></div>
          </div>
          <div class="stat">
            <span>XP</span>
            <b>{{ heroes.hero()!.xp }} / {{ heroes.hero()!.xpToNext }}</b>
          </div>
        </section>

        <section class="stack">
          <div class="card">
            <div class="campfire-scene">
              <div>[Feu de camp — scène placeholder]</div>
              <div class="hint">Phase 1 : apparence et animations</div>
            </div>
          </div>

          <div class="card">
            <h3 style="margin:0 0 .75rem">Actions</h3>
            <div class="actions">
              <div class="action"><b>Camp</b>Bâtiments & production (Phase 2)</div>
              <div class="action"><b>Inventaire</b>Équipement (Phase 3)</div>
              <div class="action"><b>Missions</b>Combat PvE auto (Phase 4)</div>
              <div class="action"><b>Forge</b>Recettes & upgrades (Phase 5)</div>
              <div class="action"><b>Sorts</b>Apprentissage (Phase 6)</div>
              <div class="action"><b>Arène</b>PvP classé (Phase 7)</div>
              <div class="action"><b>Quêtes du jour</b>Mini-jeux (Phase 8)</div>
            </div>
          </div>
        </section>
      }

      @if (error()) {
        <div class="card" style="color: var(--danger); grid-column: 1 / -1">{{ error() }}</div>
      }
    </main>
  `,
})
export class CampfireComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly heroes = inject(HeroesService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.heroes.loadMine();
    } catch (err: unknown) {
      this.error.set((err as Error).message ?? 'Erreur inconnue');
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  pct(v: number): string {
    return `${Math.round(v * 100)}%`;
  }
}
