import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  RESOURCE_LABELS,
  dailyGoldFor,
  type DailyQuestState,
  type MinigameCode,
  type MinigamePlayResult,
  type MinigameState,
  type ResourceType,
} from '@swordgame/shared';
import { DailyService } from '../../../core/daily/daily.service';
import { MinigamesService } from '../../../core/minigames/minigames.service';
import { QuestsService } from '../../../core/quests/quests.service';
import { ResourcesService } from '../../../core/resources/resources.service';
import { HeroesService } from '../../../core/heroes/heroes.service';
import { PanelComponent } from '../ui/panel.component';

type Tab = 'claim' | 'quests' | 'minigames';

@Component({
  selector: 'sg-daily-claim-panel',
  standalone: true,
  imports: [FormsModule, PanelComponent],
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

      /* ---- claim tab ---- */
      .header { text-align: center; padding: 0.5rem 0 1rem; }
      .header .big { font-size: 2rem; font-weight: 700; color: #ffd28a; }
      .header small { color: var(--fg-muted); }
      .streak-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; margin: 1rem 0; }
      .day {
        padding: 0.5rem 0.25rem;
        border: 1px solid #3a2a18; background: #241810;
        border-radius: 6px; text-align: center; font-size: 0.75rem;
      }
      .day.past { opacity: 0.5; }
      .day.today { border-color: #c77a2c; background: #3a2413; color: #ffd9a8; }
      .day .d { display: block; color: var(--fg-muted); font-size: 0.7rem; }
      .day .g { font-weight: 700; }
      .actions { display: flex; justify-content: center; margin-top: 0.8rem; }
      .actions button { padding: 0.55rem 1.4rem; font-size: 1rem; }
      .claimed { text-align: center; color: var(--fg-muted); margin-top: 0.5rem; }

      /* ---- quests tab ---- */
      .list { display: grid; gap: 0.45rem; }
      .quest {
        padding: 0.55rem 0.7rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-left-width: 3px;
        border-radius: 6px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.3rem 0.6rem;
      }
      .quest.completed { border-left-color: #8ec04a; }
      .quest.active    { border-left-color: #ffae3b; }
      .quest.claimed   { opacity: 0.6; border-left-color: #6b4a26; }
      .quest b { color: #ffd9a8; }
      .quest .desc { grid-column: 1 / -1; color: var(--fg-muted); font-size: 0.78rem; }
      .quest .bar {
        grid-column: 1 / -1;
        height: 6px; background: rgba(0,0,0,0.5);
        border: 1px solid #3a2a18; border-radius: 999px; overflow: hidden;
      }
      .quest .bar > div {
        height: 100%;
        background: linear-gradient(90deg, #ff8a3d, #ffd28a);
        transition: width 0.3s;
      }
      .quest .reward { grid-column: 1 / -1; font-size: 0.78rem; color: #ffd28a; }
      .quest button {
        padding: 0.3rem 0.6rem; font-size: 0.8rem;
        background: #c77a2c; color: #18100a; border: none;
      }
      .quest button:disabled { opacity: 0.5; cursor: not-allowed; }

      /* ---- minigames tab ---- */
      .minigame {
        padding: 0.65rem 0.75rem;
        background: #241810;
        border: 1px solid #3a2a18;
        border-radius: 8px;
        margin-bottom: 0.5rem;
      }
      .minigame h4 { margin: 0 0 0.2rem; color: #ffd9a8; }
      .minigame .sub { color: var(--fg-muted); font-size: 0.8rem; margin-bottom: 0.5rem; }
      .minigame .free-tag {
        display: inline-block; padding: 0.1rem 0.45rem;
        border-radius: 999px; background: #3a2413; color: #ffd28a;
        border: 1px solid #6b4a26; font-size: 0.72rem;
        margin-left: 0.4rem;
      }
      .play-row {
        display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;
      }
      .play-row input { width: 90px; padding: 0.3rem; }
      .play-row select { width: auto; padding: 0.3rem; }
      .play-row button {
        padding: 0.3rem 0.8rem; font-size: 0.85rem;
        background: #c77a2c; color: #18100a; border: none;
      }
      .play-row button:disabled { opacity: 0.5; cursor: not-allowed; }

      .result {
        margin-top: 0.5rem;
        padding: 0.45rem 0.6rem;
        background: #1a100a; border: 1px solid #3a2a18;
        border-radius: 6px;
        font-size: 0.85rem;
      }
      .result.win { color: #8ec04a; border-color: #4a6a2a; }
      .result.loss { color: #d88; border-color: #6b2a2a; }
      .result .dice { font-family: monospace; font-size: 1rem; letter-spacing: 0.4rem; }

      .error { color: var(--danger); font-size: 0.85rem; margin-top: 0.4rem; }
    `,
  ],
  template: `
    <sg-panel title="Journalier" (closed)="closed.emit()">
      <div class="tabs">
        <button [class.active]="tab() === 'claim'"     (click)="switchTab('claim')">Connexion</button>
        <button [class.active]="tab() === 'quests'"    (click)="switchTab('quests')">Quêtes</button>
        <button [class.active]="tab() === 'minigames'" (click)="switchTab('minigames')">Mini-jeux</button>
      </div>

      <!-- ===== CLAIM ===== -->
      @if (tab() === 'claim') {
        @if (loading()) {
          <div>Chargement…</div>
        } @else {
          <div class="header">
            <div class="big">+{{ dailyState()?.previewGold ?? 0 }} or</div>
            <small>Streak actuel : {{ dailyState()?.streak ?? 0 }} jour(s)</small>
          </div>

          <div class="streak-row">
            @for (d of [1,2,3,4,5,6,7]; track d) {
              <div class="day"
                   [class.past]="d < (dailyState()?.streak ?? 0) + (dailyState()?.canClaimToday ? 0 : 1)"
                   [class.today]="d === (dailyState()?.streak ?? 0) + 1 && dailyState()?.canClaimToday">
                <span class="d">J{{ d }}</span>
                <span class="g">+{{ goldFor(d) }}</span>
              </div>
            }
          </div>

          @if (dailyState()?.canClaimToday) {
            <div class="actions">
              <button type="button" [disabled]="busy()" (click)="claimDaily()">
                {{ busy() ? 'Réclamation…' : 'Réclamer' }}
              </button>
            </div>
          } @else {
            <div class="claimed">Déjà réclamé aujourd'hui. Reviens demain !</div>
          }
        }
      }

      <!-- ===== QUESTS ===== -->
      @if (tab() === 'quests') {
        <div class="list">
          @if (quests().length === 0) {
            <div class="claimed">Chargement…</div>
          } @else {
            @for (q of quests(); track q.code) {
              <div class="quest"
                   [class.completed]="q.completed && !q.claimed"
                   [class.active]="!q.completed"
                   [class.claimed]="q.claimed">
                <div>
                  <b>{{ q.name }}</b>
                </div>
                @if (!q.claimed) {
                  <button type="button"
                          [disabled]="!q.completed || busy()"
                          (click)="claimQuest(q)">
                    {{ q.claimed ? 'Réclamé' : q.completed ? 'Réclamer' : 'En cours' }}
                  </button>
                } @else {
                  <span style="color: var(--fg-muted); font-size: 0.78rem;">Réclamée ✓</span>
                }
                <div class="desc">{{ q.description }}</div>
                <div class="bar"><div [style.width.%]="(q.progress / q.target) * 100"></div></div>
                <div class="reward">
                  {{ q.progress }}/{{ q.target }} ·
                  +{{ q.reward.xp }} XP · +{{ q.reward.gold }} or
                  @for (r of rewardEntries(q); track r.type) {
                    · +{{ r.amount }} {{ resourceLabel(r.type) }}
                  }
                </div>
              </div>
            }
          }
        </div>
      }

      <!-- ===== MINIGAMES ===== -->
      @if (tab() === 'minigames') {
        @for (m of minigames(); track m.code) {
          <div class="minigame">
            <h4>
              {{ m.def.name }}
              @if (m.freePlayAvailable) { <span class="free-tag">1 partie gratuite</span> }
            </h4>
            <div class="sub">{{ m.def.description }}</div>

            @if (m.code === 'COIN_FLIP') {
              <div class="play-row">
                <select [(ngModel)]="coinChoice" name="coin">
                  <option value="HEADS">Pile</option>
                  <option value="TAILS">Face</option>
                </select>
                <input type="number" [min]="m.def.minBet" [max]="m.def.maxBet"
                       [(ngModel)]="coinBet" name="coinBet" />
                <button type="button"
                        [disabled]="busy()"
                        (click)="play('COIN_FLIP', coinBet, coinChoice)">
                  {{ m.freePlayAvailable ? 'Jouer gratis' : 'Jouer (' + coinBet + ' or)' }}
                </button>
              </div>
            } @else {
              <div class="play-row">
                <input type="number" [min]="m.def.minBet" [max]="m.def.maxBet"
                       [(ngModel)]="diceBet" name="diceBet" />
                <button type="button"
                        [disabled]="busy()"
                        (click)="play('DICE_ROLL', diceBet)">
                  {{ m.freePlayAvailable ? 'Jouer gratis' : 'Jouer (' + diceBet + ' or)' }}
                </button>
              </div>
            }

            @if (lastResult(); as r) {
              @if (r.code === m.code) {
                <div class="result" [class.win]="r.win" [class.loss]="!r.win">
                  @if (r.code === 'COIN_FLIP') {
                    <div>
                      Tu as misé <b>{{ r.choice === 'HEADS' ? 'Pile' : 'Face' }}</b>,
                      tombé <b>{{ r.flipOutcome === 'HEADS' ? 'Pile' : 'Face' }}</b>.
                    </div>
                  } @else {
                    <div class="dice">🎲 {{ (r.diceRoll ?? []).join(' ') }} = {{ r.diceSum }}</div>
                  }
                  <div>
                    {{ r.win ? '✦ Gagné !' : '✗ Perdu.' }}
                    Net : {{ r.netGold >= 0 ? '+' : '' }}{{ r.netGold }} or
                    · Solde : {{ r.newGold }} or
                    @if (r.wasFree) { · <em>gratuite</em> }
                  </div>
                </div>
              }
            }
          </div>
        }
      }

      @if (error()) { <div class="error">{{ error() }}</div> }
    </sg-panel>
  `,
})
export class DailyClaimPanelComponent implements OnInit {
  private readonly dailySvc = inject(DailyService);
  private readonly questsSvc = inject(QuestsService);
  private readonly minigamesSvc = inject(MinigamesService);
  private readonly resourcesSvc = inject(ResourcesService);
  private readonly heroesSvc = inject(HeroesService);

  readonly closed = output<void>();

  protected readonly tab = signal<Tab>('claim');
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly lastResult = signal<MinigamePlayResult | null>(null);

  protected readonly dailyState = this.dailySvc.state;
  protected readonly quests = this.questsSvc.today;
  protected readonly minigames = this.minigamesSvc.state;

  protected coinChoice: 'HEADS' | 'TAILS' = 'HEADS';
  protected coinBet = 10;
  protected diceBet = 20;

  async ngOnInit(): Promise<void> {
    try {
      await Promise.all([
        this.dailySvc.loadState(),
        this.questsSvc.loadToday(),
        this.minigamesSvc.loadState(),
      ]);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async switchTab(t: Tab): Promise<void> {
    this.tab.set(t);
    this.error.set(null);
    this.lastResult.set(null);
    if (t === 'quests') await this.questsSvc.loadToday();
    if (t === 'minigames') await this.minigamesSvc.loadState();
  }

  protected goldFor(streakDay: number): number {
    return dailyGoldFor(streakDay);
  }

  protected rewardEntries(q: DailyQuestState): Array<{ type: ResourceType; amount: number }> {
    const out: Array<{ type: ResourceType; amount: number }> = [];
    for (const [k, v] of Object.entries(q.reward.resources ?? {})) {
      if (v && v > 0) out.push({ type: k as ResourceType, amount: v });
    }
    return out;
  }

  protected resourceLabel(t: ResourceType): string {
    return RESOURCE_LABELS[t];
  }

  protected async claimDaily(): Promise<void> {
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

  protected async claimQuest(q: DailyQuestState): Promise<void> {
    if (!q.completed || q.claimed) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.questsSvc.claim(q.code);
      await Promise.all([
        this.resourcesSvc.loadMine(),
        this.heroesSvc.loadMine(),
      ]);
    } catch (err) {
      this.error.set(this.msg(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async play(
    code: MinigameCode,
    bet: number,
    choice?: 'HEADS' | 'TAILS',
  ): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const r = await this.minigamesSvc.play(code, Number(bet), choice);
      this.lastResult.set(r);
      await Promise.all([
        this.minigamesSvc.loadState(),
        this.resourcesSvc.loadMine(),
        this.questsSvc.loadToday(),
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
