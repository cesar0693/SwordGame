import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Notification } from '@swordgame/shared';
import { NotificationsService } from '../../../core/notifications/notifications.service';

@Component({
  selector: 'sg-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        position: fixed;
        right: 0.75rem;
        bottom: 5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 40;
        pointer-events: none;
      }

      .toast {
        pointer-events: auto;
        min-width: 240px;
        max-width: 360px;
        background: linear-gradient(180deg, rgba(34, 22, 12, 0.95), rgba(22, 14, 8, 0.95));
        border: 1px solid #6b4a26;
        border-left-width: 3px;
        border-radius: 8px;
        padding: 0.55rem 0.7rem;
        color: var(--fg);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(2px);
        animation: slide-in 220ms ease-out;
      }
      .toast.MISSION_COMPLETED { border-left-color: #ffae3b; }
      .toast.PVP_ATTACKED      { border-left-color: #d88; }
      .toast.COMPANION_READY   { border-left-color: #8ec04a; }

      .toast .row {
        display: flex; align-items: baseline; justify-content: space-between;
        gap: 0.5rem;
      }
      .toast b { color: #ffd9a8; font-size: 0.92rem; }
      .toast button {
        background: transparent; color: var(--fg-muted);
        border: 0; font-size: 0.95rem; cursor: pointer; padding: 0;
      }
      .toast button:hover { color: #ffd9a8; }
      .toast p { margin: 0.2rem 0 0; font-size: 0.82rem; color: var(--fg); }

      @keyframes slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `,
  ],
  template: `
    @for (n of notifs.inbox(); track n.id) {
      <div class="toast" [class]="n.type">
        <div class="row">
          <b>{{ n.title }}</b>
          <button type="button" (click)="dismiss(n)">✕</button>
        </div>
        <p>{{ n.message }}</p>
      </div>
    }
  `,
})
export class ToastHostComponent {
  protected readonly notifs = inject(NotificationsService);

  protected dismiss(n: Notification): void {
    this.notifs.dismiss(n.id);
  }
}
