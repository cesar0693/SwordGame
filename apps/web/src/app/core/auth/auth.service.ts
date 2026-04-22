import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from '@swordgame/shared';
import { env } from '../env';

const ACCESS_KEY = 'sg.access';
const REFRESH_KEY = 'sg.refresh';
const USER_KEY = 'sg.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly user = signal<AuthUser | null>(this.readStoredUser());
  readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_KEY));
  readonly isAuthenticated = computed(() => !!this.accessToken());

  async register(payload: RegisterRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${env.apiBaseUrl}/api/auth/register`, payload),
    );
    this.persist(res);
  }

  async login(payload: LoginRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${env.apiBaseUrl}/api/auth/login`, payload),
    );
    this.persist(res);
  }

  async refresh(): Promise<string | null> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const tokens = await firstValueFrom(
        this.http.post<AuthTokens>(`${env.apiBaseUrl}/api/auth/refresh`, { refreshToken }),
      );
      this.persistTokens(tokens);
      return tokens.accessToken;
    } catch {
      this.clear();
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${env.apiBaseUrl}/api/auth/logout`, {}),
      );
    } catch {
      // ignore
    }
    this.clear();
    await this.router.navigate(['/login']);
  }

  private persist(res: AuthResponse): void {
    this.persistTokens(res.tokens);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.user.set(res.user);
  }

  private persistTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    this.accessToken.set(tokens.accessToken);
  }

  private clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this.accessToken.set(null);
    this.user.set(null);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}
