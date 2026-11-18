import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bienvenido } from './bienvenido';

describe('Bienvenido', () => {
  let component: Bienvenido;
  let fixture: ComponentFixture<Bienvenido>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Bienvenido]
    });
    fixture = TestBed.createComponent(Bienvenido);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
