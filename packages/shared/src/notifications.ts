export type NotificationType =
  | 'MISSION_COMPLETED'
  | 'PVP_ATTACKED'
  | 'COMPANION_READY';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** Server time (ISO) the event was emitted. */
  emittedAt: string;
  /** Optional payload (mission code, attacker name, companion role…). */
  data?: Record<string, unknown>;
}
