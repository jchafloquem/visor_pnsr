import { computed, inject, Injectable, signal } from '@angular/core';
import { AreaUsuario, UnidadOperativa, Usuario } from './auth.models';
import { SEED_USERS } from '../../data/seed-users.data';
import { StorageService } from '../storage/storage.service';

@Injectable({ providedIn: 'root' })
export class SspAuthService {
  private readonly storage = inject(StorageService);

  readonly allUsers: readonly Usuario[] = SEED_USERS;
  readonly visibleUsers = computed<Usuario[]>(() =>
    this.allUsers.filter((u) => !u.oculto),
  );

  readonly currentUser = signal<Usuario>(this.resolveInitialUser());
  readonly isLoggedIn = signal<boolean>(this.storage.get<boolean>('logged', false));

  readonly userInitials = computed<string>(() =>
    this.getInitials(this.currentUser().nombre),
  );

  readonly userRoleSubtitle = computed<string>(() => {
    const u = this.currentUser();
    return u.rol === 'dir'
      ? 'Dirección Ejecutiva'
      : `${u.cargo} · ${this.formatAreaLabel(u.area)}`;
  });

  readonly isRegistrador = computed<boolean>(() => this.currentUser().rol === 'reg');
  readonly isUpp = computed<boolean>(() => this.currentUser().rol === 'upp');
  readonly isDirector = computed<boolean>(() => this.currentUser().rol === 'dir');

  switchDemoUser(userId: string): Usuario {
    return this.loginAsUser(userId);
  }

  private resolveInitialUser(): Usuario {
    const savedId = this.storage.get<string>('me', 'ana');
    return this.allUsers.find((u) => u.id === savedId) ?? this.allUsers[0];
  }

  loginByEmail(email: string): Usuario {
    const clean = email.trim().toLowerCase();
    const matched =
      this.allUsers.find((u) => {
        const parts = u.nombre
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .split(' ');
        if (parts.length < 2) return false;
        const prefix = parts[0][0] + parts[1];
        return clean.startsWith(prefix);
      }) ?? this.currentUser();

    this.setSession(matched);
    return matched;
  }

  loginAsUser(userId: string): Usuario {
    const user = this.allUsers.find((u) => u.id === userId) ?? this.allUsers[0];
    this.setSession(user);
    return user;
  }

  private setSession(user: Usuario): void {
    this.currentUser.set(user);
    this.isLoggedIn.set(true);
    this.storage.set('me', user.id);
    this.storage.set('logged', true);
  }

  logout(): void {
    this.isLoggedIn.set(false);
    this.storage.set('logged', false);
  }

  getUserById(id: string | undefined | null): Usuario {
    if (!id) {
      return {
        id: '',
        nombre: '—',
        cargo: '',
        area: 'UTP',
        sub: '',
        rol: 'reg',
      };
    }
    return (
      this.allUsers.find((u) => u.id === id) ?? {
        id,
        nombre: '—',
        cargo: '',
        area: 'UTP',
        sub: '',
        rol: 'reg',
      }
    );
  }

  getInitials(nombre: string): string {
    return nombre
      .split(' ')
      .filter((part) => part.length > 0)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatAreaLabel(area: AreaUsuario | string): string {
    if (area === 'AMAZONÍA RURAL') return 'Amazonía Rural';
    if (area === 'DE') return 'Dirección Ejecutiva';
    return area;
  }

  canEditUnit(uo: UnidadOperativa | string): boolean {
    const me = this.currentUser();
    return me.rol === 'reg' && me.area === uo;
  }

  canValidateUnit(uo: UnidadOperativa | string): boolean {
    const me = this.currentUser();
    return me.rol === 'reg' && Boolean(me.valida) && me.area === uo;
  }

  canPrioritize(): boolean {
    const me = this.currentUser();
    return me.rol === 'upp' || me.rol === 'dir';
  }

  canExportProject(projectUo: UnidadOperativa | string): boolean {
    const me = this.currentUser();
    return me.rol !== 'reg' || projectUo === me.area;
  }

  canExportWordDraft(): boolean {
    const me = this.currentUser();
    return me.rol === 'upp' || (me.rol === 'reg' && Boolean(me.valida));
  }

  isAssignedToMe(projectUo: string, assignedUserId: string): boolean {
    const me = this.currentUser();
    return me.valida ? projectUo === me.area : assignedUserId === me.id;
  }
}
