import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSgpiService } from '@services/auth-sgpi.service';

/**
 * Guard funcional para proteger rutas del módulo SGPI.
 */
export const authSgpiGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthSgpiService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/auth']);
  return false;
};
