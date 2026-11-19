import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SspAuthService } from './auth.service';

export const sspAuthGuard: CanActivateFn = () => {
  const auth = inject(SspAuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/seguimiento/acceso']);
};

export const uppRoleGuard: CanActivateFn = () => {
  const auth = inject(SspAuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/seguimiento/acceso']);
  }
  if (auth.currentUser().rol === 'upp') {
    return true;
  }
  return router.createUrlTree(['/seguimiento/dashboard']);
};
