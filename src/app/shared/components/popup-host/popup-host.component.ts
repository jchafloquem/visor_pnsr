// import {
//   Component,
//   inject,
//   HostListener,
//   ViewChild,
//   ElementRef,
//   effect,
//   ChangeDetectionStrategy,
// } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { PopupService } from '@app/services/popup.service';

// @Component({
//   selector: 'app-popup-host',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './popup-host.component.html',
//   styleUrls: ['./popup-host.component.css'],
//   changeDetection: ChangeDetectionStrategy.OnPush,
// })
// export class PopupHostComponent {
//   readonly popupService = inject(PopupService);

//   @ViewChild('dialogBox') dialogBox?: ElementRef<HTMLDivElement>;

//   constructor() {
//     effect(() => {
//       const activo = this.popupService.dialogoActivo();
//       if (activo) {
//         setTimeout(() => {
//           this.enfocarElementoInicial();
//         }, 50);
//       }
//     });
//   }

//   @HostListener('document:keydown.escape', ['$event'])
//   onEscape(event: Event): void {
//     const activo = this.popupService.dialogoActivo();
//     if (activo && activo.cerrableConEsc) {
//       event.preventDefault();
//       this.cerrarDialogo(null);
//     }
//   }

//   @HostListener('document:keydown.tab', ['$event'])
//   onTab(event: Event): void {
//     const activo = this.popupService.dialogoActivo();
//     if (!activo || !this.dialogBox) return;

//     const kEvent = event as KeyboardEvent;
//     const focusable = this.dialogBox.nativeElement.querySelectorAll<HTMLElement>(
//       'button:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]'
//     );
//     if (focusable.length === 0) return;

//     const first = focusable[0];
//     const last = focusable[focusable.length - 1];

//     if (kEvent.shiftKey) {
//       if (document.activeElement === first) {
//         event.preventDefault();
//         last.focus();
//       }
//     } else {
//       if (document.activeElement === last) {
//         event.preventDefault();
//         first.focus();
//       }
//     }
//   }

//   cerrarDialogo(valor: any): void {
//     this.popupService.cerrarDialogoActivo(valor);
//   }

//   private enfocarElementoInicial(): void {
//     if (!this.dialogBox) return;
//     const inicial = this.dialogBox.nativeElement.querySelector<HTMLElement>('[data-focus-initial="true"]');
//     if (inicial) {
//       inicial.focus();
//       return;
//     }
//     const primerBoton = this.dialogBox.nativeElement.querySelector<HTMLElement>('button');
//     primerBoton?.focus();
//   }
// }
