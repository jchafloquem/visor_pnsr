import { Component, inject, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../../../services/auth.service';
import { environment } from '../../../../../../../environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './navbar.css',
})
export class Navbar {
  login = output<void>();

  private readonly authService = inject(AuthService);
  public isAuthenticated = this.authService.isAuthenticated;
  public userName = this.authService.userName;
  public showLogoutModal = signal(false);

  /** URL de la encuesta de salida (abierta al cerrar sesión). */
  private readonly encuestaSalidaUrl = environment.encuestaSalidaUrl;

  onLoginClick(): void {
    if (this.isAuthenticated()) {
      this.showLogoutModal.set(true);
    } else {
      this.login.emit();
    }
  }

  confirmLogout(): void {
    this.authService.logout();
    this.showLogoutModal.set(false);
    // Abre la encuesta de salida en una pestaña nueva.
    window.open(this.encuestaSalidaUrl, '_blank', 'noopener,noreferrer');
    // Opcional: Redirigir a la página de inicio o recargar.
    // window.location.reload();
  }
  cancelLogout(): void {
    this.showLogoutModal.set(false);
  }
}
