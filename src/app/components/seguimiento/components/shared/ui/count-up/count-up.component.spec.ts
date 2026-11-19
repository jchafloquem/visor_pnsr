import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CountUpComponent } from './count-up.component';

describe('CountUpComponent', () => {
  it('renders formatted value immediately when duration is 0', () => {
    TestBed.configureTestingModule({
      imports: [CountUpComponent],
    });

    const fixture = TestBed.createComponent(CountUpComponent);
    fixture.componentRef.setInput('value', 44.7);
    fixture.componentRef.setInput('decimals', 1);
    fixture.componentRef.setInput('suffix', ' %');
    fixture.componentRef.setInput('duration', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent?.trim()).toBe('44.7 %');
  });

  it('formats integer counts without decimals by default', () => {
    TestBed.configureTestingModule({
      imports: [CountUpComponent],
    });

    const fixture = TestBed.createComponent(CountUpComponent);
    fixture.componentRef.setInput('value', 105);
    fixture.componentRef.setInput('duration', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent?.trim()).toBe('105');
  });
});
