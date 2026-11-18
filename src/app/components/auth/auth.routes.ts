import { Routes } from '@angular/router';

export default [
	{
		path: 'login',
		title: 'Login',
		loadComponent: () => import('./components/login/login').then(m => m.Login),
	},
	{
		path: 'bienvenido',
		title: 'Bienvenido',
		loadComponent: () => import('./components/bienvenido/bienvenido').then(m => m.Bienvenido),
	},
	{
		path: '',
		redirectTo: 'bienvenido',
		pathMatch: 'full',
	},
	{
		path: '**',
		redirectTo: 'bienvenido',
		pathMatch: 'full',
	},
] as Routes
