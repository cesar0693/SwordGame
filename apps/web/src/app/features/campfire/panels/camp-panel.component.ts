import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  COMPANION_CATALOG,
  type Companion,
  type CompanionRole,
  type ResourceType,
} from '@swordgame/shared';
import { CompanionsService } from '../../../core/companions/companions.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';
import { PerkPickerComponent } from './perk-picker.component';

@Component({
  selector: 'sg-camp-panel',
  standalone: true,
  imports: [PanelComponent, PerkPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .resources {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.4rem;
        margin-bottom: 0.9rem;
      }
      .res {
        background: #241810; border: 1px solid #3a2a18; border-radius: 6px;
        padding: 0.3rem 0.4rem; text-align: center;
      }
      .res .t { color: var(--fg-muted); font-size: 0.7rem; }
      .res .a { font-weight: 700; font-size: 0.95rem; }

      .grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.6rem;
      }
      @media (min-width: 520px) {
        .grid { grid-template-columns: 1fr 1fr; }
      }

      .card {
        display: grid;
        grid-template-columns: 44px 1fr;
        gap: 0.6rem;
        padding: 0.6rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 8px;
      }
      .card.locked { opacity: 0.7; }
      .card.pending { border-color: #c77a2c; box-shadow: 0 0 0 1px #c77a2c; }

      .glyph {
        width: 44px; height: 44px;
        display: grid; place-items: center;
        background: radial-gradient(circle, #3a2413, #1c100a);
        border: 1px solid #6b4a26;
        border-radius: 8px;
        color: #ffd9a8;
        font-weight: 700;
      }

      .title { display: flex; justify-content: space-between; align-items: baseline; }
      .title b { color: var(--fg); }
      .title .lvl { color: var(--fg-muted); font-size: 0.8rem; }

      .tagline { color: var(--fg-muted); font-size: 0.78rem; margin: 0.15rem 0 0.35rem; }

      .bar {
        height: 8px; background: rgba(0,0,0,0.5);
        border: 1px solid #3a2a18; border-radius: 999px; overflow: hidden;
      }
      .bar > div { height: 100%; transition: width 0.3s linear; }
      .bar .working { background: linear-gradient(90deg, #ff8a3d, #ffd28a); }
      .bar .done    { background: linear-gradient(90deg, #3b8044, #8ec04a); }

      .meta {
        display: flex; justify-content: space-between;
        font-size: 0.75rem; color: var(--fg-muted);
        margin-top: 0.2rem;
      }

      .actions { display: flex; gap: 0.35rem; margin-top: 0.45rem; flex-wrap: wrap; }
      .actions button {
        padding: 0.3rem 0.5rem; font-size: 0.8rem;
        background: #3a2413; color: #ffd9a8; border: 1px solid #6b4a26;
      }
      .actions button:hover:not(:disabled) { background: #4a2e1a; }
      .actions button.primary { background: #c77a2c; color: #18100a; border: none; }
      .actions button.primary:hover:not(:disabled) { background: #e09040; }

      .cost { font-size: 0.75rem; color: var(--fg-muted); }
      .error { color: var(--danger); font-size: 0.78rem; margin-top: 0.2rem; }

      .pending-ribbon {
        font-size: 0.72rem;
        color: #ffb86b;
        margin-top: 0.3rem;
      }
    `,
  ],
  template: `
    <sg-panel title="Camp & compagnons" (closed)="closed.emit()">
      <div class="resources">
        @for (r of resourceEntries(); track r.type) {
          <div class="res">
            <div class="t">{{ resourceLabel(r.type) }}</div>
            <div class="a">{{ r.amount }}</div>
          </div>
        }
      </div>

      <div class="grid">
        @for (c of companions(); track c.role) {
          @let spec = catalog[c.role];
          <div
            class="card"
            [class.locked]="c.state === 'LOCKED'"
            [class.pending]="c.pendingPerkLevel !== null"
          >
            <div class="glyph">{{ glyph(c.role) }}</div>
            <div>
              <div class="title">
                <b>{{ spec.name }}</b>
                <span class="lvl">Niv. {{ c.level }} · Outils {{ c.toolDurability }}%</span>
              </div>
              <div class="tagline">{{ spec.tagline }}</div>

              @if (c.state === 'LOCKED') {
                <div class="cost">
                  Débloque à Niv {{ spec.unlockHeroLevel }} · Coût :
                  {{ formatCost(spec.unlockCost) || 'gratuit' }}
                </div>
                <div class="actions">
                  <button
                    type="button"
                    class="primary"
                    [disabled]="busy() === c.role"
                    (click)="unlock(c.role)"
                  >
                    Débloquer
                  </button>
                </div>
              } @else if (c.pendingPerkLevel !== null) {
                <div class="pending-ribbon">
                  ✦ Choix de spécialisation Niv {{ c.pendingPerkLevel }} en attente
                </div>
                <div class="actions">
                  <button
                    type="button"
                    class="primary"
                    (click)="openPicker(c)"
                  >
                    Choisir une voie
                  </button>
                </div>
              } @else if (c.state === 'WORKING') {
                <div class="bar">
                  <div
                    [class.working]="progress(c) < 100"
                    [class.done]="progress(c) >= 100"
                    [style.width.%]="progress(c)"
                  ></div>
                </div>
                <div class="meta">
                  <span>{{ outputLabel(c.role) }}</span>
                  <span>{{ remaining(c) }}</span>
                </div>
                <div class="actions">
                  <button
                    type="button"
                    class="primary"
                    [disabled]="progress(c) < 100 || busy() === c.role"
                    (click)="claim(c.role)"
                  >
                    {{ progress(c) < 100 ? 'En cours…' : 'Récupérer' }}
                  </button>
                </div>
              } @else {
                <!-- IDLE -->
                <div class="meta">
                  <span>{{ outputLabel(c.role) }}</span>
                  <span>{{ spec.baseCycleSeconds }}s / cycle</span>
                </div>
                <div class="actions">
                  <button
                    type="button"
                    class="primary"
                    [disabled]="busy() === c.role"
                    (click)="start(c.role)"
                  >
                    Démarrer
                  </button>
                </div>
              }

              @if (errorFor()[c.role]) {
                <div class="error">{{ errorFor()[c.role] }}</div>
              }
            </div>
          </div>
        }
      </div>

      @if (pickerFor(); as p) {
        <sg-perk-picker
          [companion]="p"
          (picked)="onPerkPicked($event)"
          (closed)="closePicker()"
        />
      }
    </sg-panel>
  `,
})
export class CampPanelComponent implements OnInit {
  private readonly companionsSvc = inject(CompanionsService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();

  readonly companions = this.companionsSvc.companions;
  readonly resourceEntries = this.resourcesSvc.resources;

  protected readonly catalog = COMPANION_CATALOG;
  protected readonly busy = signal<CompanionRole | null>(null);
  protected readonly errorFor = signal<Record<string, string | null>>({});
  protected readonly pickerFor = signal<Companion | null>(null);

  // trigger re-render for progress bars every 500ms
  protected readonly tick = signal(0);

  constructor() {
    interval(500)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.tick.update((t) => t + 1));
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.companionsSvc.loadMine(), this.resourcesSvc.loadMine()]);
  }

  protected glyph(role: CompanionRole): string {
    switch (role) {
      case 'MINER': return '⛏';
      case 'WOODCUTTER': return '🪓';
      case 'FARMER': return '🌾';
      case 'GATHERER': return '🌿';
      case 'ALCHEMIST': return '⚗';
      case 'BAKER': return '🥖';
      case 'BLACKSMITH': return '⚒';
    }
  }

  protected resourceLabel(t: ResourceType): string {
    const map: Record<ResourceType, string> = {
      WOOD: 'Bois', IRON: 'Fer', LEATHER: 'Cuir', HERB: 'Herbe', GOLD: 'Or', GEM: 'Gemme',
    };
    return map[t];
  }

  protected outputLabel(role: CompanionRole): string {
    const spec = this.catalog[role];
    const t = spec.baseOutput.type;
    switch (t) {
      case 'POTION': return 'Potion';
      case 'BREAD':  return 'Pain';
      case 'ITEM':   return 'Équipement';
      default: return this.resourceLabel(t as ResourceType);
    }
  }

  protected formatCost(cost: Partial<Record<ResourceType, number>>): string {
    return Object.entries(cost)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `${v} ${this.resourceLabel(k as ResourceType)}`)
      .join(', ');
  }

  protected progress(c: Companion): number {
    // read `tick` so Angular recomputes on the interval
    void this.tick();
    if (c.state !== 'WORKING' || !c.cycleStartAt || !c.cycleFinishAt) return 0;
    const start = Date.parse(c.cycleStartAt);
    const end = Date.parse(c.cycleFinishAt);
    const now = Date.now();
    if (now >= end) return 100;
    const total = end - start;
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, ((now - start) / total) * 100));
  }

  protected remaining(c: Companion): string {
    void this.tick();
    if (!c.cycleFinishAt) return '';
    const ms = Date.parse(c.cycleFinishAt) - Date.now();
    if (ms <= 0) return 'Prêt !';
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }

  protected async unlock(role: CompanionRole): Promise<void> {
    await this.guarded(role, () => this.companionsSvc.unlock(role));
    await this.resourcesSvc.loadMine();
  }

  protected async start(role: CompanionRole): Promise<void> {
    await this.guarded(role, () => this.companionsSvc.start(role));
    await this.resourcesSvc.loadMine();
  }

  protected async claim(role: CompanionRole): Promise<void> {
    await this.guarded(role, () => this.companionsSvc.claim(role));
    await this.resourcesSvc.loadMine();
  }

  protected openPicker(c: Companion): void {
    this.pickerFor.set(c);
  }

  protected closePicker(): void {
    this.pickerFor.set(null);
  }

  protected async onPerkPicked(evt: { role: CompanionRole; level: number; code: string }): Promise<void> {
    await this.guarded(evt.role, () =>
      this.companionsSvc.pickPerk(evt.role, evt.level, evt.code),
    );
    this.pickerFor.set(null);
  }

  private async guarded<T>(role: CompanionRole, fn: () => Promise<T>): Promise<T | null> {
    this.busy.set(role);
    this.setErr(role, null);
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message ?? 'Erreur';
      this.setErr(role, msg);
      return null;
    } finally {
      this.busy.set(null);
    }
  }

  private setErr(role: CompanionRole, msg: string | null): void {
    this.errorFor.update((m) => ({ ...m, [role]: msg }));
  }
}
