import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap, map } from 'rxjs/operators';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface SgpiUser {
  nombre: string;
  correo: string;
  rol: string;
  unidad: string;
}

export interface LoginRequest {
  correo: string;
  clave: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: SgpiUser;
  message?: string;
}

// ── Constantes ──────────────────────────────────────────────────────────────

const STORAGE_KEY_TOKEN = 'sgpi_token';
const STORAGE_KEY_USER = 'sgpi_user';

// ── Servicio ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AuthSgpiService {
  // Signals de estado
  readonly isAuthenticated = signal<boolean>(false);
  readonly currentUser = signal<SgpiUser | null>(null);
  readonly token = signal<string | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.restoreSession();
  }

  // ── Métodos públicos ────────────────────────────────────────────────────

  /**
   * Simula un POST de login.
   * Acepta cualquier correo con dominio @vivienda.gob.pe y contraseña no vacía.
   */
  login(correo: string, clave: string, rolDemo?: string): Observable<LoginResponse> {
    this.loading.set(true);
    this.error.set(null);

    // Validación básica
    if (!correo || !clave) {
      this.loading.set(false);
      this.error.set('Correo y contraseña son requeridos.');
      return throwError(() => new Error('Correo y contraseña son requeridos.'));
    }

    if (!correo.endsWith('@vivienda.gob.pe')) {
      this.loading.set(false);
      this.error.set('Solo se permiten correos del dominio @vivienda.gob.pe.');
      return throwError(() => new Error('Solo se permiten correos del dominio @vivienda.gob.pe.'));
    }

    // Construir usuario simulado
    const nombreParts = correo.split('@')[0].split('.');
    const nombre = nombreParts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

    const user: SgpiUser = {
      nombre,
      correo,
      rol: rolDemo ?? 'Registrador UTP',
      unidad: 'Unidad Técnica de Proyectos',
    };

    const fakeToken = this.generateFakeJwt(user);

    const response: LoginResponse = {
      success: true,
      token: fakeToken,
      user,
      message: 'Inicio de sesión exitoso.',
    };

    return of(response).pipe(
      delay(1200),
      tap((res) => {
        // Persistir en localStorage
        localStorage.setItem(STORAGE_KEY_TOKEN, res.token);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(res.user));

        // Actualizar signals
        this.token.set(res.token);
        this.currentUser.set(res.user);
        this.isAuthenticated.set(true);
        this.loading.set(false);
        this.error.set(null);
      })
    );
  }

  /** Cierra la sesión: limpia localStorage y resetea signals. */
  logout(): void {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USER);

    this.token.set(null);
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.loading.set(false);
    this.error.set(null);
  }

  /** Devuelve `true` si existe un token activo. */
  isLoggedIn(): boolean {
    return this.token() !== null;
  }

  /** Devuelve el token actual o `null`. */
  getToken(): string | null {
    return this.token();
  }

  // ── Métodos privados ───────────────────────────────────────────────────

  /** Restaura la sesión desde localStorage al instanciar el servicio. */
  private restoreSession(): void {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    const savedUser = localStorage.getItem(STORAGE_KEY_USER);

    if (savedToken && savedUser) {
      try {
        const user: SgpiUser = JSON.parse(savedUser);
        this.token.set(savedToken);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch {
        // Si el JSON está corrupto, limpiar todo
        this.logout();
      }
    }
  }

  /** Genera un JWT falso (base64) con la información del usuario. */
  private generateFakeJwt(user: SgpiUser): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: user.correo,
      nombre: user.nombre,
      rol: user.rol,
      unidad: user.unidad,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    };
    const signature = 'simulated-signature';

    const encode = (obj: object): string =>
      btoa(JSON.stringify(obj))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${encode(header)}.${encode(payload)}.${btoa(signature).replace(/=/g, '')}`;
  }
}
