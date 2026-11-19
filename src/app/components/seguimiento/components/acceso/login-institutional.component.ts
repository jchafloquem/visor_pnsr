import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { SspAuthService } from '../../core/auth/auth.service';
import { Usuario } from '../../core/auth/auth.models';
import { INSTITUTIONAL_CONFIG } from '../../core/config/institutional.constants';
import { LayoutStore } from '../../core/layout/layout.store';
import { IconComponent } from '../shared/icons/icon.component';

@Component({
  selector: 'app-auth-login-institutional',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  templateUrl: './login-institutional.component.html',
  styleUrl: './login-institutional.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLoginInstitutionalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly sspAuth = inject(SspAuthService);
  private readonly layoutStore = inject(LayoutStore);

  readonly demoEnabled = INSTITUTIONAL_CONFIG.demoMode;
  readonly mostrarClave = signal(false);
  readonly error = signal<string | null>(null);

  readonly loginForm = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    clave: ['', [Validators.required, Validators.minLength(4)]],
  });

  toggleClave(): void {
    this.mostrarClave.update((v) => !v);
  }

  enviar(): void {
    this.error.set(null);
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error.set('Ingrese un correo institucional válido y su contraseña.');
      return;
    }

    const { correo } = this.loginForm.getRawValue();
    const user = this.sspAuth.loginByEmail(correo);
    this.completeLogin(user);
  }

  entrarComoDemo(user: Usuario): void {
    this.error.set(null);
    const logged = this.sspAuth.loginAsUser(user.id);
    this.completeLogin(logged);
  }

  private completeLogin(user: Usuario): void {
    const saludo =
      user.rol === 'dir' ? 'Dirección Ejecutiva' : user.nombre;
    this.layoutStore.showToast(`Bienvenido(a), ${saludo}`);
    this.router.navigate(['/seguimiento/dashboard']);
  }
}
