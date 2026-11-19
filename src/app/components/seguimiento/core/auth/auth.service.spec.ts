import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../storage/storage.service';
import { SspAuthService } from './auth.service';

describe('SspAuthService', () => {
  let auth: SspAuthService;
  let storage: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    storage = TestBed.inject(StorageService);
    storage.clearAll();
    auth = TestBed.inject(SspAuthService);
  });

  afterEach(() => {
    storage.clearAll();
  });

  it('switches roles and evaluates permissions accurately', () => {
    // Ana Torres (reg, UTP, non-validator)
    auth.loginAsUser('ana');
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.isRegistrador()).toBe(true);
    expect(auth.canEditUnit('UTP')).toBe(true);
    expect(auth.canEditUnit('PIASAR')).toBe(false);
    expect(auth.canValidateUnit('UTP')).toBe(false);
    expect(auth.canPrioritize()).toBe(false);
    expect(auth.canExportWordDraft()).toBe(false);

    // Luis Quispe (reg, UTP, validator)
    auth.loginAsUser('luis');
    expect(auth.canValidateUnit('UTP')).toBe(true);
    expect(auth.canExportWordDraft()).toBe(true);

    // Carla Mendoza (UPP)
    auth.loginAsUser('carla');
    expect(auth.isUpp()).toBe(true);
    expect(auth.canPrioritize()).toBe(true);
    expect(auth.canExportWordDraft()).toBe(true);
    expect(auth.canExportProject('AMAZONÍA RURAL')).toBe(true);

    // Dirección Ejecutiva
    auth.loginAsUser('de');
    expect(auth.isDirector()).toBe(true);
    expect(auth.canPrioritize()).toBe(true);
    expect(auth.canExportWordDraft()).toBe(false);

    // Logout
    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
  });
});
