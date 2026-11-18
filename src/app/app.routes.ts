import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./components/auth/auth'),
    loadChildren: () => import('./components/auth/auth.routes')
  },
  {
    path: 'visor',
    loadComponent: () => import('./components/visor/visor'),
    loadChildren: () => import('./components/visor/visor.routes')
  },
  {
    path: '',
    redirectTo: '/auth',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/auth',
    pathMatch: 'full',
  },
  {
    path: 'proyectos',
    title: 'Bandeja de proyectos - PNSR',
    loadComponent: () =>
      import('./projects/project-inbox/project-inbox.component').then(
        (m) => m.ProjectInboxComponent,
      ),
  },
  {
    path: 'proyectos/nuevo',
    redirectTo: 'proyectos',
    pathMatch: 'full',
  },
  {
    path: 'proyectos/editar/:cui',
    title: 'Definir prioridad de proyecto - PNSR',
    loadComponent: () =>
      import('./projects/project-form/project-form.component').then(
        (m) => m.ProjectFormComponent,
      ),
  },
  {
    path: 'proyectos/detalle/:cui',
    title: 'Detalle del proyecto - PNSR',
    loadComponent: () =>
      import('./projects/project-detail/project-detail.component').then(
        (m) => m.ProjectDetailComponent,
      ),
  },
  {
    path: 'proyectos/riesgos/:cui',
    title: 'Gestión de riesgos - PNSR',
    loadComponent: () =>
      import('./projects/project-risks/project-risks.component').then(
        (m) => m.ProjectRisksComponent,
      ),
  }
];
