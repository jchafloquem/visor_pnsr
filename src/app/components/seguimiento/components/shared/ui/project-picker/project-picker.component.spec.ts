import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { LayoutStore } from '../../../../core/layout/layout.store';
import { ProyectoSsp } from '../../../cartera/models/ssp.models';
import { ProjectPickerComponent } from './project-picker.component';

const MOCK_PROJECTS = [
  { cui: '2451001', corto: 'Agua Potable Chota' },
  { cui: '2451002', corto: 'Saneamiento Huancabamba' },
] as unknown as ProyectoSsp[];

describe('ProjectPickerComponent', () => {
  it('displays CUI and short name and emits valid CUI changes', () => {
    const showToast = vi.fn();
    TestBed.configureTestingModule({
      imports: [ProjectPickerComponent],
      providers: [{ provide: LayoutStore, useValue: { showToast } }],
    });

    const fixture = TestBed.createComponent(ProjectPickerComponent);
    fixture.componentRef.setInput('projects', MOCK_PROJECTS);
    fixture.componentRef.setInput('selectedCui', '2451001');
    fixture.detectChanges();

    const emitted: string[] = [];
    fixture.componentInstance.cuiChange.subscribe((cui) => emitted.push(cui));

    const inputEl = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(inputEl.value).toBe('2451001 · Agua Potable Chota');

    inputEl.value = '2451002 · Saneamiento Huancabamba';
    inputEl.dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['2451002']);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('reverts invalid text and displays a toast', () => {
    const showToast = vi.fn();
    TestBed.configureTestingModule({
      imports: [ProjectPickerComponent],
      providers: [{ provide: LayoutStore, useValue: { showToast } }],
    });

    const fixture = TestBed.createComponent(ProjectPickerComponent);
    fixture.componentRef.setInput('projects', MOCK_PROJECTS);
    fixture.componentRef.setInput('selectedCui', '2451001');
    fixture.detectChanges();

    const inputEl = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    inputEl.value = 'inexistente';
    inputEl.dispatchEvent(new Event('change'));

    expect(inputEl.value).toBe('2451001 · Agua Potable Chota');
    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
