import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  COMPANION_CATALOG,
  RESOURCE_LABELS,
  effectiveCycleSeconds,
  effectiveQuantity,
  type Companion,
  type CompanionRole,
  type ResourceTrack,
  type SkillAxis,
} from '@swordgame/shared';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-skill-picker',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .lead { color: var(--fg-muted); margin: 0 0 0.5rem; }
      .points {
        display: inline-block; padding: 0.15rem 0.55rem;
        border-radius: 999px; background: #3a2413; color: #ffd28a;
        border: 1px solid #6b4a26; font-weight: 700; font-size: 0.85rem;
        margin-bottom: 0.8rem;
      }

      .tracks { display: grid; gap: 0.6rem; }

      .track {
        padding: 0.7rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 8px;
      }
      .track.locked { opacity: 0.55; }
      .track h3 {
        margin: 0 0 0.25rem; font-size: 0.95rem;
        display: flex; justify-content: space-between; align-items: baseline;
      }
      .track h3 b { color: var(--fg); }
      .track h3 small { color: var(--fg-muted); font-size: 0.75rem; font-weight: 400; }

      .stats { color: var(--fg-muted); font-size: 0.82rem; margin-bottom: 0.5rem; }
      .arrow { color: #8ec04a; }

      .axis-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
      .axis {
        background: #2a1b10; border: 1px solid #3a2a18; color: var(--fg);
        text-align: left; padding: 0.5rem 0.6rem; border-radius: 6px;
        cursor: pointer; font-size: 0.85rem; line-height: 1.2;
      }
      .axis:hover:not(:disabled) { border-color: #c77a2c; }
      .axis:disabled { cursor: not-allowed; opacity: 0.5; }
      .axis b { display: block; color: #ffd9a8; margin-bottom: 0.1rem; }
      .axis span { color: var(--fg-muted); font-size: 0.78rem; }
    `,
  ],
  template: `
    <sg-panel title="Spécialisation · {{ roleName() }}" (closed)="closed.emit()">
      <p class="lead">
        Chaque point améliore une ressource : <b>+ quantité</b> OU <b>− temps</b>.
      </p>
      <div class="points">Points disponibles : {{ points() }}</div>

      <div class="tracks">
        @for (t of tracks(); track t.code) {
          @let locked = t.unlockAtLevel > companion().level;
          <div class="track" [class.locked]="locked">
            <h3>
              <b>{{ labelFor(t) }}</b>
              <small>
                @if (locked) {
                  Déverrouille au Niv {{ t.unlockAtLevel }}
                } @else {
                  Niv requis {{ t.unlockAtLevel }}
                }
              </small>
            </h3>

            <div class="stats">
              Temps : {{ baseSeconds(t) }}s
              @if (pickedSpeed(t.code)) {
                <span class="arrow">→ {{ currentSeconds(t) }}s</span>
              }
              · Quantité : {{ t.baseOutput }}
              @if (pickedQty(t.code)) {
                <span class="arrow">→ {{ currentQty(t) }}</span>
              }
            </div>

            <div class="axis-row">
              <button
                class="axis"
                type="button"
                [disabled]="locked || points() <= 0"
                (click)="spend(t.code, 'QUANTITY')"
              >
                <b>+ Quantité</b>
                <span>
                  {{ t.baseOutput }} → {{ nextQty(t) }} ({{ pickedQty(t.code) }} pick(s))
                </span>
              </button>
              <button
                class="axis"
                type="button"
                [disabled]="locked || points() <= 0"
                (click)="spend(t.code, 'SPEED')"
              >
                <b>− Temps</b>
                <span>
                  {{ currentSeconds(t) }}s → {{ nextSeconds(t) }}s ({{ pickedSpeed(t.code) }} pick(s))
                </span>
              </button>
            </div>
          </div>
        }
      </div>
    </sg-panel>
  `,
})
export class SkillPickerComponent {
  readonly companion = input.required<Companion>();
  readonly spent = output<{ role: CompanionRole; trackCode: string; axis: SkillAxis }>();
  readonly closed = output<void>();

  protected readonly tracks = computed(() =>
    COMPANION_CATALOG[this.companion().role].tracks,
  );
  protected readonly points = computed(() => this.companion().skillPointsUnspent);
  protected readonly roleName = computed(() =>
    COMPANION_CATALOG[this.companion().role].name,
  );

  protected labelFor(t: ResourceTrack): string {
    const res = RESOURCE_LABELS[t.resource];
    return t.code === t.resource ? res : `${t.code} (${res})`;
  }

  protected baseSeconds(t: ResourceTrack): number {
    return t.baseCycleSeconds;
  }

  protected pickedQty(code: string): number {
    return this.companion().spends.filter((s) => s.trackCode === code && s.axis === 'QUANTITY').length;
  }

  protected pickedSpeed(code: string): number {
    return this.companion().spends.filter((s) => s.trackCode === code && s.axis === 'SPEED').length;
  }

  protected currentSeconds(t: ResourceTrack): number {
    return effectiveCycleSeconds(t, this.companion().spends);
  }

  protected currentQty(t: ResourceTrack): number {
    return effectiveQuantity(t, this.companion().spends);
  }

  protected nextSeconds(t: ResourceTrack): number {
    const simulated = [...this.companion().spends, { trackCode: t.code, axis: 'SPEED' as const }];
    return effectiveCycleSeconds(t, simulated);
  }

  protected nextQty(t: ResourceTrack): number {
    const simulated = [...this.companion().spends, { trackCode: t.code, axis: 'QUANTITY' as const }];
    return effectiveQuantity(t, simulated);
  }

  protected spend(trackCode: string, axis: SkillAxis): void {
    if (this.points() <= 0) return;
    this.spent.emit({ role: this.companion().role, trackCode, axis });
  }
}
