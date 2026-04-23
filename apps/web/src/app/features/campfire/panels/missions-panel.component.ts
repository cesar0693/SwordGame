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
import {
  type CombatReport,
  type Item,
  type MissionDef,
} from '@swordgame/shared';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { ItemsService } from '../../../core/items/items.service';
import { MissionsService } from '../../../core/missions/missions.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';
import { CombatReportComponent } from './combat-report.component';

@Component({
  selector: 'sg-missions-panel',
  standalone: true,
  imports: [PanelComponent, CombatReportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .lead { color: var(--fg-muted); margin: 0 0 0.8rem; font-size: 0.85rem; }

      .active-card {
        padding: 0.8rem;
        background: #2a1b10;
        border: 1px solid #6b4a26;
        border-radius: 8px;
        margin-bottom: 0.9rem;
      }
      .active-card h3 { margin: 0 0 0.3rem; color: #ffd9a8; }
      .active-card .bar {
        height: 10px; background: rgba(0,0,0,0.5);
        border: 1px solid #3a2a18; border-radius: 999px; overflow: hidden;
        margin: 0.5rem 0;
      }
      .active-card .bar > div {
        height: 100%;
        background: linear-gradient(90deg, #ff8a3d, #ffd28a);
        transition: width 0.3s linear;
      }
      .active-card .meta {
        display: flex; justify-content: space-between; font-size: 0.8rem;
        color: var(--fg-muted);
      }
      .active-card .cta { display: flex; justify-content: flex-end; margin-top: 0.5rem; }

      .mission-list { display: grid; gap: 0.5rem; }
      .mission {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.4rem 0.7rem;
        padding: 0.6rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 8px;
      }
      .mission.locked { opacity: 0.55; }
      .mission b { color: #ffd9a8; }
      .mission .desc { color: var(--fg-muted); font-size: 0.8rem; grid-column: 1 / -1; }
      .mission .meta {
        grid-column: 1 / -1;
        display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem;
        font-size: 0.78rem; color: var(--fg-muted);
      }
      .mission button {
        align-self: center;
        padding: 0.4rem 0.8rem;
        background: #c77a2c; color: #18100a; border: none; font-weight: 600;
      }
      .mission button:disabled { opacity: 0.5; cursor: not-allowed; }

      .loadout {
        padding: 0.75rem;
        background: #1a100a;
        border: 1px solid #3a2a18;
        border-radius: 8px;
      }
      .loadout h4 { margin: 0 0 0.4rem; color: #ffd9a8; font-size: 0.9rem; }
      .consumables {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 0.35rem;
      }
      .consumable {
        padding: 0.4rem 0.5rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .consumable.picked { border-color: #c77a2c; background: #3a2413; }
      .consumable.disabled { opacity: 0.4; cursor: not-allowed; }
      .consumable small { color: var(--fg-muted); display: block; font-size: 0.72rem; }

      .back { margin-top: 0.5rem; text-align: right; }
      .back button { background: transparent; color: var(--fg-muted); border: 1px solid #3a2a18; }
      .error { color: var(--danger); font-size: 0.85rem; margin-top: 0.4rem; }
    `,
  ],
  template: `
    <sg-panel title="Missions" (closed)="closed.emit()">
      <!-- Active run -->
      @if (active(); as run) {
        @let def = missionByCode(run.missionCode);
        @if (def) {
          <div class="active-card">
            <h3>En cours : {{ def.name }}</h3>
            <div>
              <div class="bar"><div [style.width.%]="progress(run)"></div></div>
              <div class="meta">
                <span>{{ run.status === 'PENDING' ? 'En combat…' : 'Terminé' }}</span>
                <span>{{ remaining(run) }}</span>
              </div>
              <div class="cta">
                <button type="button" [disabled]="progress(run) < 100 || busy()"
                        (click)="claim(run.runId)">
                  {{ progress(run) < 100 ? 'Patience…' : 'Récupérer' }}
                </button>
              </div>
            </div>
          </div>
        }
      }

      <!-- Loadout phase -->
      @if (selected(); as sel) {
        <p class="lead">
          <b>{{ sel.name }}</b> — {{ sel.description }}
        </p>
        <div class="loadout">
          <h4>Consommables (max 3)</h4>
          @if (consumables().length === 0) {
            <p class="lead">Aucun consommable. Fais travailler l'Alchimiste ou le Boulanger.</p>
          } @else {
            <div class="consumables">
              @for (c of consumables(); track c.id) {
                <div
                  class="consumable"
                  [class.picked]="isPicked(c.id)"
                  [class.disabled]="!isPicked(c.id) && picks().length >= 3"
                  (click)="togglePick(c)"
                >
                  <b>{{ c.name }}</b>
                  <small>×{{ c.stack }} — {{ effectText(c) }}</small>
                </div>
              }
            </div>
          }
          @if (error()) { <div class="error">{{ error() }}</div> }
          <div class="cta back">
            <button type="button" (click)="selected.set(null)">Retour</button>
            <button type="button" style="margin-left: .4rem; background: #c77a2c; color: #18100a;"
                    [disabled]="busy() || !!active()" (click)="launch()">
              {{ busy() ? 'Lancement…' : 'Lancer la mission' }}
            </button>
          </div>
        </div>
      } @else if (!active()) {
        <p class="lead">Choisis une mission. Ton niveau de héros doit correspondre.</p>
        <div class="mission-list">
          @for (m of catalog(); track m.code) {
            <div class="mission" [class.locked]="heroLevel() < m.minHeroLevel">
              <div>
                <b>{{ m.name }}</b>
                <span style="color: var(--fg-muted); font-size: 0.78rem;">
                  — Niv. {{ m.minHeroLevel }}+ · {{ formatDuration(m.durationSeconds) }}
                </span>
              </div>
              <button type="button"
                      [disabled]="heroLevel() < m.minHeroLevel"
                      (click)="selected.set(m)">
                Préparer
              </button>
              <div class="desc">{{ m.description }}</div>
              <div class="meta">
                <span>Ennemi : {{ m.enemy.name }} ({{ m.enemy.hp }} PV, {{ m.enemy.attack }} ATQ)</span>
                <span>+{{ m.rewardXp }} XP</span>
                <span>+{{ m.rewardGold }} or</span>
              </div>
            </div>
          }
        </div>
      }

      @if (lastReport(); as r) {
        <sg-combat-report [report]="r" (closed)="lastReport.set(null)" />
      }
    </sg-panel>
  `,
})
export class MissionsPanelComponent implements OnInit {
  private readonly missionsSvc = inject(MissionsService);
  private readonly itemsSvc = inject(ItemsService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly heroesSvc = inject(HeroesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();

  readonly catalog = this.missionsSvc.catalog;
  readonly active = this.missionsSvc.active;
  readonly consumables = this.missionsSvc.consumables;

  readonly selected = signal<MissionDef | null>(null);
  readonly picks = signal<string[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastReport = signal<CombatReport | null>(null);
  protected readonly tick = signal(0);

  protected readonly heroLevel = computed(() => this.heroesSvc.hero()?.level ?? 1);

  constructor() {
    interval(500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick.update((t) => t + 1));
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.missionsSvc.loadCatalog(),
      this.missionsSvc.loadActive(),
      this.missionsSvc.loadConsumables(),
    ]);
  }

  protected missionByCode(code: string): MissionDef | null {
    return this.catalog().find((m) => m.code === code) ?? null;
  }

  protected progress(run: { startAt: string; finishAt: string }): number {
    void this.tick();
    const start = Date.parse(run.startAt);
    const end = Date.parse(run.finishAt);
    const now = Date.now();
    if (now >= end) return 100;
    const total = end - start;
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, ((now - start) / total) * 100));
  }

  protected remaining(run: { finishAt: string }): string {
    void this.tick();
    const ms = Date.parse(run.finishAt) - Date.now();
    if (ms <= 0) return 'Prêt !';
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    return `${m}m ${(sec % 60).toString().padStart(2, '0')}s`;
  }

  protected formatDuration(s: number): string {
    if (s < 60) return `${s}s`;
    return `${Math.round(s / 60)}m`;
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
    const e = (c.effect ?? {}) as { type?: string; hp?: number; mp?: number; amount?: number; stat?: string; durationTurns?: number };
    if (e.type === 'HEAL_HP') return `Soigne ${e.hp} PV`;
    if (e.type === 'HEAL_MP') return `Restaure ${e.mp} PM`;
    if (e.type === 'BUFF') return `+${e.amount} ${e.stat} · ${e.durationTurns} tours`;
    return '';
  }

  protected async launch(): Promise<void> {
    const def = this.selected();
    if (!def) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.missionsSvc.start(def.code, this.picks());
      this.selected.set(null);
      this.picks.set([]);
      await Promise.all([
        this.missionsSvc.loadActive(),
        this.missionsSvc.loadConsumables(),
      ]);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async claim(runId: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const report = await this.missionsSvc.claim(runId);
      this.lastReport.set(report);
      await Promise.all([
        this.missionsSvc.loadActive(),
        this.missionsSvc.loadConsumables(),
        this.itemsSvc.loadMine(),
        this.resourcesSvc.loadMine(),
        this.heroesSvc.loadMine(),
      ]);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(false);
    }
  }

  private msg(err: unknown): string {
    return (
      (err as { error?: { message?: string } })?.error?.message ??
      (err as Error)?.message ??
      'Erreur'
    );
  }
}
