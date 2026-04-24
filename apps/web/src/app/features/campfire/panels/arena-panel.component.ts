import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import type {
  CombatReport,
  Item,
  LeaderboardEntry,
  PvpMatchSummary,
} from '@swordgame/shared';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { ItemsService } from '../../../core/items/items.service';
import { PvpService } from '../../../core/pvp/pvp.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';
import { CombatReportComponent } from './combat-report.component';

type Tab = 'leaderboard' | 'history';

@Component({
  selector: 'sg-arena-panel',
  standalone: true,
  imports: [PanelComponent, CombatReportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .tabs { display: flex; gap: 0.4rem; margin-bottom: 0.7rem;
              border-bottom: 1px solid #3a2a18; padding-bottom: 0.5rem; }
      .tabs button {
        background: transparent; color: var(--fg-muted);
        border: 1px solid transparent; padding: 0.35rem 0.7rem;
        border-radius: 6px; font-size: 0.85rem;
      }
      .tabs button.active { background: #3a2413; color: #ffd9a8; border-color: #6b4a26; }

      .lead { color: var(--fg-muted); margin: 0 0 0.5rem; font-size: 0.85rem; }
      .me-ribbon {
        background: #2a1b10; border: 1px solid #6b4a26; border-radius: 8px;
        padding: 0.45rem 0.7rem; margin-bottom: 0.6rem;
        display: flex; justify-content: space-between; align-items: center;
        font-size: 0.85rem;
      }
      .me-ribbon b { color: #ffd28a; }

      .list { display: grid; gap: 0.35rem; }

      .row {
        display: grid;
        grid-template-columns: 2.2rem 1fr auto auto;
        gap: 0.5rem;
        align-items: center;
        padding: 0.45rem 0.6rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 6px;
      }
      .row.me { border-color: #c77a2c; }
      .row .rank { color: var(--fg-muted); font-variant-numeric: tabular-nums; text-align: right; }
      .row b { color: var(--fg); }
      .row .sub { color: var(--fg-muted); font-size: 0.78rem; }
      .row .rating { color: #ffd28a; font-weight: 700; font-variant-numeric: tabular-nums; }
      .row button {
        background: #c77a2c; color: #18100a; border: none;
        padding: 0.3rem 0.6rem; font-size: 0.8rem;
      }
      .row button:disabled { opacity: 0.5; cursor: not-allowed; }

      .match {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem 0.7rem;
        padding: 0.45rem 0.6rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-left-width: 3px;
        border-radius: 6px;
        align-items: center;
      }
      .match.win  { border-left-color: #8ec04a; }
      .match.loss { border-left-color: #d88; }
      .match .who b { color: var(--fg); }
      .match .who small { color: var(--fg-muted); font-size: 0.78rem; }
      .match .delta { color: #ffd28a; font-size: 0.85rem; }
      .match .delta .neg { color: #d88; }
      .match button {
        background: transparent; color: #ffd9a8; border: 1px solid #6b4a26;
        padding: 0.3rem 0.6rem; font-size: 0.8rem;
      }

      .loadout {
        margin: 0.3rem 0 0.8rem;
        padding: 0.6rem;
        background: #1a100a; border: 1px solid #3a2a18; border-radius: 8px;
      }
      .loadout h4 { margin: 0 0 0.4rem; color: #ffd9a8; font-size: 0.85rem; }
      .consumables { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.3rem; }
      .consumable {
        padding: 0.35rem 0.45rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.78rem;
      }
      .consumable.picked { border-color: #c77a2c; background: #3a2413; }
      .consumable.disabled { opacity: 0.4; cursor: not-allowed; }
      .consumable small { color: var(--fg-muted); display: block; font-size: 0.7rem; }

      .empty { color: var(--fg-muted); text-align: center; padding: 1rem; }
      .error { color: var(--danger); font-size: 0.85rem; margin-top: 0.4rem; }
    `,
  ],
  template: `
    <sg-panel title="Arène" (closed)="closed.emit()">
      <div class="tabs">
        <button [class.active]="tab() === 'leaderboard'" (click)="switchTab('leaderboard')">Classement</button>
        <button [class.active]="tab() === 'history'"     (click)="switchTab('history')">Mes combats</button>
      </div>

      @if (cooldown(); as cd) {
        <div class="me-ribbon">
          <span>
            Mon rang : <b>{{ heroRank() ?? '—' }}</b> · Note <b>{{ heroRating() }}</b>
          </span>
          <span>
            @if (cd.ready) { Prêt à défier. } @else { Cooldown : {{ cooldownLabel() }} }
          </span>
        </div>
      }

      @if (tab() === 'leaderboard') {
        <p class="lead">Défie un joueur. Ton résultat met à jour votre score Elo à tous les deux.</p>

        <div class="loadout">
          <h4>Consommables (max 3)</h4>
          @if (consumables().length === 0) {
            <p class="lead">Aucun consommable. L'Alchimiste et le Boulanger peuvent t'en préparer.</p>
          } @else {
            <div class="consumables">
              @for (c of consumables(); track c.id) {
                <div class="consumable"
                     [class.picked]="isPicked(c.id)"
                     [class.disabled]="!isPicked(c.id) && picks().length >= 3"
                     (click)="togglePick(c)">
                  <b>{{ c.name }}</b>
                  <small>×{{ c.stack }} — {{ effectText(c) }}</small>
                </div>
              }
            </div>
          }
        </div>

        <div class="list">
          @if (leaderboard().length === 0) {
            <div class="empty">Classement vide.</div>
          } @else {
            @for (row of leaderboard(); track row.heroId) {
              <div class="row" [class.me]="row.heroId === heroId()">
                <span class="rank">#{{ row.rank }}</span>
                <div>
                  <b>{{ row.name }}</b>
                  <div class="sub">{{ classLabel(row.heroClass) }} · Niv. {{ row.level }}</div>
                </div>
                <span class="rating">{{ row.pvpRating }}</span>
                @if (row.heroId === heroId()) {
                  <button type="button" disabled>Toi</button>
                } @else {
                  <button type="button"
                          [disabled]="!canChallenge() || busy() === row.heroId"
                          (click)="challenge(row)">
                    Défier
                  </button>
                }
              </div>
            }
          }
        </div>
      }

      @if (tab() === 'history') {
        <p class="lead">Derniers combats (attaques et défenses).</p>
        <div class="list">
          @if (matches().length === 0) {
            <div class="empty">Aucun combat.</div>
          } @else {
            @for (m of matches(); track m.id) {
              @let wasWin = isWin(m);
              @let youAttacked = m.attackerId === heroId();
              <div class="match" [class.win]="wasWin" [class.loss]="!wasWin">
                <div class="who">
                  <b>{{ wasWin ? 'Victoire' : 'Défaite' }}</b>
                  <small>
                    {{ youAttacked ? 'Attaque' : 'Défense' }} vs
                    {{ youAttacked ? m.defenderName : m.attackerName }}
                  </small>
                </div>
                <div class="delta">
                  {{ ratingDeltaLabel(m) }}
                  · {{ relativeTime(m.playedAt) }}
                </div>
                <button type="button" (click)="openReport(m)">Rapport</button>
              </div>
            }
          }
        </div>
      }

      @if (error()) { <div class="error">{{ error() }}</div> }

      @if (viewing(); as r) {
        <sg-combat-report [report]="r" (closed)="viewing.set(null)" />
      }
    </sg-panel>
  `,
})
export class ArenaPanelComponent implements OnInit {
  private readonly pvpSvc = inject(PvpService);
  private readonly itemsSvc = inject(ItemsService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly heroesSvc = inject(HeroesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();

  readonly leaderboard = this.pvpSvc.leaderboard;
  readonly matches = this.pvpSvc.matches;
  readonly cooldown = this.pvpSvc.cooldown;

  readonly tab = signal<Tab>('leaderboard');
  readonly picks = signal<string[]>([]);
  readonly busy = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly viewing = signal<CombatReport | null>(null);

  protected readonly tick = signal(0);
  protected readonly consumables = computed(() =>
    this.itemsSvc.items().filter((i) => i.kind === 'CONSUMABLE'),
  );

  protected readonly heroId = computed(() => this.heroesSvc.hero()?.id ?? null);
  protected readonly heroRating = computed(() => {
    const id = this.heroId();
    return this.leaderboard().find((l) => l.heroId === id)?.pvpRating ?? 1000;
  });
  protected readonly heroRank = computed(() => {
    const id = this.heroId();
    return this.leaderboard().find((l) => l.heroId === id)?.rank ?? null;
  });
  protected readonly canChallenge = computed(() => {
    void this.tick();
    return this.cooldown()?.ready ?? false;
  });

  constructor() {
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick.update((t) => t + 1));
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.pvpSvc.loadLeaderboard(),
      this.pvpSvc.loadCooldown(),
      this.itemsSvc.loadMine(),
    ]);
  }

  protected async switchTab(t: Tab): Promise<void> {
    this.tab.set(t);
    this.error.set(null);
    if (t === 'history') {
      await this.pvpSvc.loadMatches();
    } else {
      await Promise.all([this.pvpSvc.loadLeaderboard(), this.pvpSvc.loadCooldown()]);
    }
  }

  protected classLabel(c: string): string {
    switch (c) {
      case 'WARRIOR': return 'Guerrier';
      case 'MAGE':    return 'Mage';
      case 'RANGER':  return 'Rôdeur';
      default: return c;
    }
  }

  protected isPicked(id: string): boolean {
    return this.picks().includes(id);
  }

  protected togglePick(c: Item): void {
    const arr = [...this.picks()];
    const i = arr.indexOf(c.id);
    if (i >= 0) arr.splice(i, 1);
    else if (arr.length < 3) arr.push(c.id);
    this.picks.set(arr);
  }

  protected effectText(c: Item): string {
    const e = (c.effect ?? {}) as {
      type?: string; hp?: number; mp?: number; amount?: number; stat?: string; durationTurns?: number;
    };
    if (e.type === 'HEAL_HP') return `Soigne ${e.hp} PV`;
    if (e.type === 'HEAL_MP') return `Restaure ${e.mp} PM`;
    if (e.type === 'BUFF') return `+${e.amount} ${e.stat} · ${e.durationTurns} tours`;
    return '';
  }

  protected cooldownLabel(): string {
    const cd = this.cooldown();
    if (!cd || cd.ready) return '';
    void this.tick();
    // Recompute live from nextReadyAt so the label ticks down each second
    if (cd.nextReadyAt) {
      const ms = Date.parse(cd.nextReadyAt) - Date.now();
      if (ms <= 0) return '0s';
      const s = Math.ceil(ms / 1000);
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}m ${r.toString().padStart(2, '0')}s`;
    }
    return `${cd.secondsRemaining}s`;
  }

  protected async challenge(row: LeaderboardEntry): Promise<void> {
    this.busy.set(row.heroId);
    this.error.set(null);
    try {
      const match = await this.pvpSvc.challenge(row.heroId, this.picks());
      this.picks.set([]);
      this.viewing.set(match.report);
      await Promise.all([
        this.pvpSvc.loadLeaderboard(),
        this.pvpSvc.loadCooldown(),
        this.pvpSvc.loadMatches(),
        this.itemsSvc.loadMine(),
        this.resourcesSvc.loadMine(),
        this.heroesSvc.loadMine(),
      ]);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(null);
    }
  }

  protected isWin(m: PvpMatchSummary): boolean {
    const you = this.heroId();
    if (m.attackerId === you) return m.outcome === 'ATTACKER_WIN';
    return m.outcome === 'DEFENDER_WIN';
  }

  protected ratingDeltaLabel(m: PvpMatchSummary): string {
    const you = this.heroId();
    const before = m.attackerId === you ? m.attackerRatingBefore : m.defenderRatingBefore;
    const after = m.attackerId === you ? m.attackerRatingAfter : m.defenderRatingAfter;
    const delta = after - before;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta} Elo (${after})`;
  }

  protected relativeTime(iso: string): string {
    const ms = Date.now() - Date.parse(iso);
    if (ms < 60_000) return "à l'instant";
    const min = Math.floor(ms / 60000);
    if (min < 60) return `il y a ${min}m`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h}h`;
    const d = Math.floor(h / 24);
    return `il y a ${d}j`;
  }

  protected openReport(m: PvpMatchSummary): void {
    this.viewing.set(m.report);
  }

  private msg(err: unknown): string {
    return (
      (err as { error?: { message?: string } })?.error?.message ??
      (err as Error)?.message ??
      'Erreur'
    );
  }
}
