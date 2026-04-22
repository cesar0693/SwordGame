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
  RESOURCE_LABELS,
  effectiveCycleSeconds,
  effectiveQuantity,
  toolRepairCost,
  type Companion,
  type CompanionRole,
  type ResourceTrack,
  type ResourceType,
  type SkillAxis,
} from '@swordgame/shared';
import { CompanionsService } from '../../../core/companions/companions.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';
import { SkillPickerComponent } from './skill-picker.component';

@Component({
  selector: 'sg-camp-panel',
  standalone: true,
  imports: [PanelComponent, SkillPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .resources {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 0.35rem;
        margin-bottom: 0.9rem;
      }
      .res {
        background: #241810; border: 1px solid #3a2a18; border-radius: 6px;
        padding: 0.3rem 0.4rem; text-align: center;
      }
      .res.zero { opacity: 0.45; }
      .res .t { color: var(--fg-muted); font-size: 0.7rem; }
      .res .a { font-weight: 700; font-size: 0.95rem; }

      .grid { display: grid; grid-template-columns: 1fr; gap: 0.6rem; }
      @media (min-width: 620px) { .grid { grid-template-columns: 1fr 1fr; } }

      .card {
        display: grid; grid-template-columns: 44px 1fr; gap: 0.6rem;
        padding: 0.6rem; background: #241810;
        border: 1px solid #3a2a18; border-radius: 8px;
      }
      .card.locked { opacity: 0.7; }
      .card.has-points {
        border-color: #c77a2c;
        box-shadow: 0 0 0 1px #c77a2c, 0 0 12px rgba(199, 122, 44, 0.3);
      }

      .glyph {
        width: 44px; height: 44px; display: grid; place-items: center;
        background: radial-gradient(circle, #3a2413, #1c100a);
        border: 1px solid #6b4a26; border-radius: 8px;
        color: #ffd9a8; font-weight: 700;
      }

      .title { display: flex; justify-content: space-between; align-items: baseline; }
      .title b { color: var(--fg); }
      .title .lvl { color: var(--fg-muted); font-size: 0.78rem; }

      .tagline { color: var(--fg-muted); font-size: 0.78rem; margin: 0.1rem 0 0.4rem; }

      .track-row {
        display: flex; align-items: center; gap: 0.4rem;
        font-size: 0.85rem; margin-bottom: 0.4rem;
      }
      .track-row select { width: auto; padding: 0.2rem 0.4rem; }
      .track-row .stats { color: var(--fg-muted); font-size: 0.78rem; }

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
        padding: 0.3rem 0.55rem; font-size: 0.8rem;
        background: #3a2413; color: #ffd9a8; border: 1px solid #6b4a26;
      }
      .actions button:hover:not(:disabled) { background: #4a2e1a; }
      .actions button.primary { background: #c77a2c; color: #18100a; border: none; }
      .actions button.primary:hover:not(:disabled) { background: #e09040; }

      .sp-chip {
        display: inline-block; margin-left: 0.35rem; padding: 0 0.4rem;
        border-radius: 999px; background: #c77a2c; color: #18100a;
        font-weight: 700; font-size: 0.72rem;
      }

      .cost { font-size: 0.75rem; color: var(--fg-muted); }
      .error { color: var(--danger); font-size: 0.78rem; margin-top: 0.2rem; }
    `,
  ],
  template: `
    <sg-panel title="Camp & compagnons" (closed)="closed.emit()">
      <div class="resources">
        @for (r of resourceEntries(); track r.type) {
          <div class="res" [class.zero]="r.amount === 0">
            <div class="t">{{ label(r.type) }}</div>
            <div class="a">{{ r.amount }}</div>
          </div>
        }
      </div>

      <div class="grid">
        @for (c of companions(); track c.role) {
          @let spec = catalog[c.role];
          @let activeTrack = trackOf(c);
          <div
            class="card"
            [class.locked]="c.state === 'LOCKED'"
            [class.has-points]="c.skillPointsUnspent > 0"
          >
            <div class="glyph">{{ glyph(c.role) }}</div>
            <div>
              <div class="title">
                <b>
                  {{ spec.name }}
                  @if (c.skillPointsUnspent > 0) {
                    <span class="sp-chip">+{{ c.skillPointsUnspent }} pt</span>
                  }
                </b>
                <span class="lvl">Niv. {{ c.level }} · Outils {{ c.toolDurability }}%</span>
              </div>
              <div class="tagline">{{ spec.tagline }}</div>

              @if (c.state === 'LOCKED') {
                <div class="cost">
                  Débloque à Niv héros {{ spec.unlockHeroLevel }} ·
                  Coût : {{ formatCost(spec.unlockCost) || 'gratuit' }}
                </div>
                <div class="actions">
                  <button type="button" class="primary"
                          [disabled]="busy() === c.role"
                          (click)="unlock(c.role)">
                    Débloquer
                  </button>
                </div>
              } @else {
                <!-- Track selection -->
                @if (c.state === 'IDLE') {
                  <div class="track-row">
                    <label>Ressource :</label>
                    <select
                      [value]="c.activeTrack"
                      (change)="switchTrack(c, $event)"
                    >
                      @for (t of spec.tracks; track t.code) {
                        <option [value]="t.code" [disabled]="t.unlockAtLevel > c.level">
                          {{ trackLabel(t) }}
                          @if (t.unlockAtLevel > c.level) { (Niv {{ t.unlockAtLevel }}) }
                        </option>
                      }
                    </select>
                  </div>
                } @else {
                  <div class="track-row">
                    <span>Sur : <b>{{ trackLabel(activeTrack) }}</b></span>
                  </div>
                }

                @if (activeTrack) {
                  <div class="stats">
                    {{ effectiveSec(activeTrack, c) }}s /
                    {{ effectiveQty(activeTrack, c) }}× {{ label(activeTrack.resource) }}
                  </div>
                }

                @if (c.state === 'WORKING') {
                  <div class="bar">
                    <div
                      [class.working]="progress(c) < 100"
                      [class.done]="progress(c) >= 100"
                      [style.width.%]="progress(c)"
                    ></div>
                  </div>
                  <div class="meta">
                    <span>{{ c.cyclesCompleted }} cycles total</span>
                    <span>{{ remaining(c) }}</span>
                  </div>
                  <div class="actions">
                    <button type="button" class="primary"
                            [disabled]="progress(c) < 100 || busy() === c.role"
                            (click)="claim(c.role)">
                      {{ progress(c) < 100 ? 'En cours…' : 'Récupérer' }}
                    </button>
                  </div>
                } @else {
                  <div class="actions">
                    <button type="button" class="primary"
                            [disabled]="busy() === c.role || c.toolDurability <= 0"
                            (click)="start(c.role)">
                      Démarrer
                    </button>
                    @if (c.toolDurability < 100) {
                      <button type="button"
                              [disabled]="busy() === c.role"
                              (click)="repair(c.role)">
                        Réparer ({{ repairCost(c) }} fer)
                      </button>
                    }
                    @if (c.skillPointsUnspent > 0) {
                      <button type="button" (click)="openPicker(c)">
                        Dépenser {{ c.skillPointsUnspent }} pt
                      </button>
                    } @else if (hasAnySpends(c)) {
                      <button type="button" (click)="openPicker(c)">Voir spécialisations</button>
                    }
                  </div>
                }
              }

              @if (errorFor()[c.role]) {
                <div class="error">{{ errorFor()[c.role] }}</div>
              }
            </div>
          </div>
        }
      </div>

      @if (pickerFor(); as p) {
        <sg-skill-picker
          [companion]="p"
          (spent)="onSpent($event)"
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
    return { MINER: '⛏', WOODCUTTER: '🪓', FARMER: '🌾', GATHERER: '🌿',
             ALCHEMIST: '⚗', BAKER: '🥖', BLACKSMITH: '⚒' }[role];
  }

  protected label(t: ResourceType): string {
    return RESOURCE_LABELS[t];
  }

  protected trackLabel(t: ResourceTrack | null): string {
    if (!t) return '—';
    const res = this.label(t.resource);
    return t.code === t.resource ? res : `${t.code} (${res})`;
  }

  protected trackOf(c: Companion): ResourceTrack | null {
    return this.catalog[c.role].tracks.find((t) => t.code === c.activeTrack) ?? null;
  }

  protected effectiveSec(t: ResourceTrack, c: Companion): number {
    return effectiveCycleSeconds(t, c.spends);
  }

  protected effectiveQty(t: ResourceTrack, c: Companion): number {
    return effectiveQuantity(t, c.spends);
  }

  protected hasAnySpends(c: Companion): boolean {
    return c.spends.length > 0;
  }

  protected formatCost(cost: Partial<Record<ResourceType, number>>): string {
    return Object.entries(cost)
      .filter(([, v]) => (v ?? 0) > 0)
      .map(([k, v]) => `${v} ${this.label(k as ResourceType)}`)
      .join(', ');
  }

  protected progress(c: Companion): number {
    void this.tick();
    if (c.state !== 'WORKING' || !c.cycleStartAt || !c.cycleFinishAt) return 0;
    const start = Date.parse(c.cycleStartAt);
    const end = Date.parse(c.cycleFinishAt);
    const now = Date.now();
    if (now >= end) return 100;
    const total = end - start;
    return total <= 0 ? 100 : Math.max(0, Math.min(100, ((now - start) / total) * 100));
  }

  protected remaining(c: Companion): string {
    void this.tick();
    if (!c.cycleFinishAt) return '';
    const ms = Date.parse(c.cycleFinishAt) - Date.now();
    if (ms <= 0) return 'Prêt !';
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    return `${m}m ${(sec % 60).toString().padStart(2, '0')}s`;
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

  protected async repair(role: CompanionRole): Promise<void> {
    await this.guarded(role, () => this.companionsSvc.repair(role));
    await this.resourcesSvc.loadMine();
  }

  protected repairCost(c: Companion): number {
    return toolRepairCost(100 - c.toolDurability);
  }

  protected async switchTrack(c: Companion, event: Event): Promise<void> {
    const code = (event.target as HTMLSelectElement).value;
    if (code === c.activeTrack) return;
    await this.guarded(c.role, () => this.companionsSvc.setTrack(c.role, code));
  }

  protected openPicker(c: Companion): void {
    this.pickerFor.set(c);
  }

  protected closePicker(): void {
    this.pickerFor.set(null);
  }

  protected async onSpent(evt: {
    role: CompanionRole;
    trackCode: string;
    axis: SkillAxis;
  }): Promise<void> {
    const updated = await this.guarded(evt.role, () =>
      this.companionsSvc.spendSkill(evt.role, evt.trackCode, evt.axis),
    );
    // keep the picker open showing the updated companion so the player can
    // continue spending if they still have points
    if (updated) this.pickerFor.set(updated);
  }

  private async guarded<T>(
    role: CompanionRole,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    this.busy.set(role);
    this.setErr(role, null);
    try {
      return await fn();
    } catch (err: unknown) {
      this.setErr(role, (err as { error?: { message?: string } })?.error?.message ?? 'Erreur');
      return null;
    } finally {
      this.busy.set(null);
    }
  }

  private setErr(role: CompanionRole, msg: string | null): void {
    this.errorFor.update((m) => ({ ...m, [role]: msg }));
  }
}
