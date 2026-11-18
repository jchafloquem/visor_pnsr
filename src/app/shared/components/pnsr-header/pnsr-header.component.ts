import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  input,
  HostListener,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthSgpiService } from '@services/auth-sgpi.service';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'app-pnsr-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pnsr-header.component.html',
  styleUrls: ['./pnsr-header.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PnsrHeaderComponent {
  private readonly authSgpi = inject(AuthSgpiService);
  private readonly authGeovisor = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);

  readonly fechaCorte = input<string>('');
  readonly menuUsuarioAbierto = signal<boolean>(false);
  readonly modalCerrarSesionAbierto = signal<boolean>(false);

  readonly usuarioActual = computed(() => {
    const sgpiUser = this.authSgpi.currentUser();
    if (sgpiUser) {
      return {
        nombre: sgpiUser.nombre,
        correo: sgpiUser.correo,
        rol: sgpiUser.rol || 'Especialista UTP',
        unidad: sgpiUser.unidad || 'Unidad Técnica de Proyectos',
      };
    }

    if (this.authGeovisor.isAuthenticated()) {
      const u = this.authGeovisor.usuario();
      const nombre = this.authGeovisor.userName() || u?.nombres || 'Usuario Institucional';
      return {
        nombre,
        correo:
          u?.correoElectronico ||
          `${(u?.codigoUsuario || 'usuario').toLowerCase()}@vivienda.gob.pe`,
        rol: 'Especialista PNSR',
        unidad: 'Programa Nacional de Saneamiento Rural',
      };
    }

    return {
      nombre: 'Ing. Carlos Mendoza Ríos',
      correo: 'cmendoza@vivienda.gob.pe',
      rol: 'Especialista UTP',
      unidad: 'Unidad Técnica de Proyectos',
    };
  });

  readonly inicialesUsuario = computed<string>(() => {
    const nombre = this.usuarioActual().nombre.trim();
    const partes = nombre
      .replace(/^Ing\.\s*|^Lic\.\s*|^CPC\.\s*|^Abog\.\s*/i, '')
      .split(/\s+/)
      .filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return (partes[0]?.slice(0, 2) || 'MV').toUpperCase();
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.menuUsuarioAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuUsuarioAbierto.set(false);
    this.modalCerrarSesionAbierto.set(false);
  }

  toggleMenuUsuario(): void {
    this.menuUsuarioAbierto.update((v) => !v);
  }

  solicitarCerrarSesion(): void {
    this.menuUsuarioAbierto.set(false);
    this.modalCerrarSesionAbierto.set(true);
  }

  cancelarCerrarSesion(): void {
    this.modalCerrarSesionAbierto.set(false);
  }

  confirmarCerrarSesion(): void {
    this.modalCerrarSesionAbierto.set(false);
    this.authSgpi.logout();
    if (this.authGeovisor.isAuthenticated()) {
      this.authGeovisor.logout();
    }
    this.router.navigate(['/login-v2']);
  }
}
