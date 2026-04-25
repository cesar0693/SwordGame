import { Injectable, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import type { Notification } from '@swordgame/shared';
import { AuthService } from '../auth/auth.service';
import { env } from '../env';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  /** Current toast queue. UI pulls from here, components remove on dismiss. */
  readonly inbox = signal<Notification[]>([]);

  /** Reconnect with the latest access token. Call once after login. */
  connect(): void {
    const token = this.auth.accessToken();
    if (!token) return;
    this.disconnect();

    this.socket = io(`${env.apiBaseUrl}/realtime`, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('notification', (n: Notification) => {
      this.inbox.update((list) => [...list, n]);
    });

    this.socket.on('connect_error', () => {
      // silent — app still works without realtime; polling-based fallback fine.
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  dismiss(id: string): void {
    this.inbox.update((list) => list.filter((n) => n.id !== id));
  }

  clear(): void {
    this.inbox.set([]);
  }
}
