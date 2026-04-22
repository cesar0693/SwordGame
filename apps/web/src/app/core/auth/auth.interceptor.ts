import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authed = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authed).pipe(
    catchError((err) => {
      if (err?.status === 401 && token) {
        return from(auth.refresh()).pipe(
          switchMap((fresh) => {
            if (!fresh) return throwError(() => err);
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${fresh}` },
            });
            return next(retried);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
