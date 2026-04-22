import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { dailyGoldFor } from '@swordgame/shared';
import { DailyService } from '../../../core/daily/daily.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { PanelComponent } from '../ui/panel.component';

@Component({
  selector: 'sg-daily-claim-panel',
  standalone: true,
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .header {
        text-align: center;
        padding: 0.5rem 0 1rem;
      }
      .header .big {
        font-size: 2rem;
        font-weight: 700;
        color: #ffd28a;
      }
      .header small { color: var(--fg-muted); }

      .streak-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.25rem;
        margin: 1rem 0;
      }
      .day {
        padding: 0.5rem 0.25rem;
        border: 1px solid #3a2a18;
        background: #241810;
        border-radius: 6px;
        text-align: center;
        font-size: 0.75rem;
      }
      .day.past { opacity: 0.5; }
      .day.today {
        border-color: #c77a2c;
        background: #3a2413;
        color: #ffd9a8;
      }
      .day .d { display: block; color: var(--fg-muted); font-size: 0.7rem; }
      .day .g { font-weight: 700; }

      .actions { display: flex; justify-content: center; margin-top: 0.8rem; }
      .actions button {
        padding: 0.55rem 1.4rem; font-size: 1rem;
      }
      .claimed { text-align: center; color: var(--fg-muted); margin-top: 0.5rem; }
    `,
  ],
  template: `
    <sg-panel title="Récompense quotidienne" (closed)="closed.emit()">
      @if (loading()) {
        <div>Chargement…</div>
      } @else {
        <div class="header">
          <div class="big">+{{ state()?.previewGold ?? 0 }} or</div>
          <small>Streak actuel : {{ state()?.streak ?? 0 }} jour(s)</small>
        </div>

        <div class="streak-row">
          @for (d of [1,2,3,4,5,6,7]; track d) {
            <div
              class="day"
              [class.past]="d < (state()?.streak ?? 0) + (state()?.canClaimToday ? 0 : 1)"
              [class.today]="d === (state()?.streak ?? 0) + 1 && state()?.canClaimToday"
            >
              <span class="d">J{{ d }}</span>
              <span class="g">+{{ goldFor(d) }}</span>
            </div>
          }
        </div>

        @if (state()?.canClaimToday) {
          <div class="actions">
            <button type="button" [disabled]="busy()" (click)="claim()">
              {{ busy() ? 'Réclamation…' : 'Réclamer' }}
            </button>
          </div>
        } @else {
          <div class="claimed">Déjà réclamé aujourd'hui. Reviens demain !</div>
        }

        @if (error()) {
          <div class="claimed" style="color: var(--danger)">{{ error() }}</div>
        }
      }
    </sg-panel>
  `,
})
export class DailyClaimPanelComponent implements OnInit {
  private readonly dailySvc = inject(DailyService);
  private readonly resourcesSvc = inject(ResourcesService);

  readonly closed = output<void>();

  protected readonly state = this.dailySvc.state;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.dailySvc.loadState();
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected goldFor(streakDay: number): number {
    return dailyGoldFor(streakDay);
  }

  protected async claim(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.dailySvc.claim();
      await Promise.all([this.dailySvc.loadState(), this.resourcesSvc.loadMine()]);
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
