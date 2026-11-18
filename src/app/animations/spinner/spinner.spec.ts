import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Spinner } from './spinner';

describe('Spinner', () => {
  let component: Spinner;
  let fixture: ComponentFixture<Spinner>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Spinner]
    })
    .compileComponents();
    fixture = TestBed.createComponent(Spinner);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the wallpaper background when enabled', () => {
    fixture.componentRef.setInput('showBackground', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.spinner-background')).not.toBeNull();
  });

  it('uses spinner.png as the default image inside the spinner', () => {
    const image: HTMLImageElement | null = fixture.nativeElement.querySelector('.spinner-center-image');

    expect(image?.getAttribute('src')).toBe('assets/images/spinner.png');
  });
});
