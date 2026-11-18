import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ControlCapas } from './control-capas';

describe('ControlCapas', () => {
  let component: ControlCapas;
  let fixture: ComponentFixture<ControlCapas>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ControlCapas]
    });
    fixture = TestBed.createComponent(ControlCapas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
