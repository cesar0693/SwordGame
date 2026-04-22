import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Modal window placed over the campfire scene.
 * - Scene stays visible behind via semi-transparent backdrop.
 * - Esc / backdrop click emits `closed`.
 */
@Component({
  selector: 'sg-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'close()',
  },
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 30; display: block; }

      .backdrop {
        position: absolute; inset: 0;
        background: rgba(5, 3, 1, 0.55);
        backdrop-filter: blur(2px);
        animation: fade 160ms ease-out;
      }

      .window {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(640px, calc(100vw - 2rem));
        max-height: calc(100dvh - 3rem);
        display: flex;
        flex-direction: column;
        background:
          linear-gradient(180deg, rgba(30, 20, 12, 0.98), rgba(22, 14, 8, 0.98));
        border: 1px solid #6b4a26;
        border-radius: 12px;
        box-shadow:
          0 18px 42px rgba(0, 0, 0, 0.55),
          0 0 0 1px rgba(255, 170, 80, 0.12) inset;
        color: var(--fg);
        overflow: hidden;
        animation: pop 180ms cubic-bezier(0.2, 0.8, 0.2, 1.1);
      }

      header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.8rem 1rem;
        border-bottom: 1px solid #513719;
        background: linear-gradient(180deg, #2a1b0d, #1a0f07);
      }
      header h2 {
        margin: 0;
        font-size: 1.05rem;
        letter-spacing: 0.02em;
        color: #ffd9a8;
      }

      .close {
        background: transparent;
        color: #ffd9a8;
        border: 1px solid #513719;
        padding: 0.25rem 0.5rem;
        font-size: 0.85rem;
      }
      .close:hover { background: #3a2413; }

      .body {
        padding: 1rem;
        overflow: auto;
      }

      @keyframes fade {
        from { opacity: 0; } to { opacity: 1; }
      }
      @keyframes pop {
        from { opacity: 0; transform: translate(-50%, -48%) scale(0.98); }
        to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
    `,
  ],
  template: `
    <div class="backdrop" (click)="close()"></div>
    <div class="window" role="dialog" aria-modal="true">
      <header>
        <h2>{{ title() }}</h2>
        <button class="close" type="button" (click)="close()">Fermer</button>
      </header>
      <div class="body">
        <ng-content />
      </div>
    </div>
  `,
})
export class PanelComponent {
  readonly title = input.required<string>();
  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
