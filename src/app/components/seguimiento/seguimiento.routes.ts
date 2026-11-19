import { Routes } from '@angular/router';
import { sspAuthGuard, uppRoleGuard } from './core/auth/auth.guard';

export default [
  {
    path: 'acceso',
    title: 'Acceso al sistema · PNSR',
    loadComponent: () =>
      import('./components/acceso/login-institutional.component').then(
        (m) => m.AuthLoginInstitutionalComponent
      ),
  },
  {
    path: '',
    canActivate: [sspAuthGuard],
    loadComponent: () =>
      import('./components/layout/shell.component').then((m) => m.SspShellComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        title: 'Inicio · Seguimiento de Proyectos — PNSR',
        loadComponent: () =>
          import('./components/dashboard/pages/inicio-page.component').then(
            (m) => m.InicioPageComponent
          ),
      },
      {
        path: 'cartera',
        title: 'Proyectos · PNSR',
        loadComponent: () =>
          import('./components/cartera/pages/proyectos-page.component').then(
            (m) => m.ProyectosPageComponent
          ),
      },
      {
        path: 'avance-semanal',
        title: 'Registro semanal · PNSR',
        loadComponent: () =>
          import('./components/avance-semanal/pages/seguimiento-page.component').then(
            (m) => m.SeguimientoPageComponent
          ),
      },
      {
        path: 'priorizados',
        title: 'Cartera priorizada · PNSR',
        loadComponent: () =>
          import('./components/priorizados/pages/priorizados-page.component').then(
            (m) => m.PriorizadosPageComponent
          ),
      },
      {
        path: 'riesgos',
        title: 'Riesgos · PNSR',
        loadComponent: () =>
          import('./components/riesgos/pages/riesgos-page.component').then(
            (m) => m.RiesgosPageComponent
          ),
      },
      {
        path: 'alertas',
        title: 'Alertas · PNSR',
        loadComponent: () =>
          import('./components/alertas/pages/alertas-page.component').then(
            (m) => m.AlertasPageComponent
          ),
      },
      {
        path: 'compromisos',
        title: 'Compromisos · PNSR',
        loadComponent: () =>
          import('./components/compromisos/pages/compromisos-page.component').then(
            (m) => m.CompromisosPageComponent
          ),
      },
      {
        path: 'reportes',
        title: 'Reportes · PNSR',
        loadComponent: () =>
          import('./components/reportes/pages/reportes-page.component').then(
            (m) => m.ReportesPageComponent
          ),
      },
      {
        path: 'parametros',
        title: 'Parámetros · PNSR',
        canActivate: [uppRoleGuard],
        loadComponent: () =>
          import('./components/parametros/pages/parametros-page.component').then(
            (m) => m.ParametrosPageComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
] as Routes;
