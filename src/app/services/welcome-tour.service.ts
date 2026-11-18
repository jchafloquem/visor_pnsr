import { Injectable } from '@angular/core';
import { driver } from 'driver.js';

@Injectable({ providedIn: 'root' })
export class WelcomeTourService {
  startWelcomeTour(): void {
    driver({
      showProgress: true,
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Finalizar',
      steps: [
        {
          element: '#welcome-title',
          popover: {
            title: '¡Bienvenido al GeoVisor!',
            description: 'Esta es nuestra plataforma central. Te daremos un breve recorrido por sus funciones principales.',
          },
        },
        {
          element: '#main-buttons',
          popover: {
            title: 'Accesos Directos',
            description: 'Desde aquí puedes navegar a las secciones más importantes de la aplicación.',
          },
        },
        {
          element: '#button-visor',
          popover: {
            title: 'Visor Geográfico',
            description: 'El corazón de la plataforma. Ingresa aquí para interactuar con los mapas y datos georreferenciados.',
          },
        },
        {
          element: '#button-dashboard',
          popover: {
            title: 'Dashboard de Estadísticas',
            description: 'Visualiza los datos y metas de manera gráfica e interactiva. Un resumen completo del progreso.',
          },
        },
        {
          element: '#button-reportes',
          popover: {
            title: 'Generador de Reportes',
            description: 'Crea y descarga reportes personalizados en formato PDF con la información que necesites. En este momento se encuentra en elaboración.',
          },
        },
        {
          element: '#button-repositorio',
          popover: {
            title: 'Repositorio Documental',
            description: 'Accede a toda la documentación técnica, manuales y guías relacionadas con la plataforma.',
          },
        },
        {
          element: '#button-metadata',
          popover: {
            title: 'Catálogo de Metadatos',
            description: 'Consulta la información detallada sobre el origen, calidad y características de nuestros datos geográficos.',
          },
        },
        {
          element: '#social-media-links',
          popover: {
            title: 'Mantente Conectado',
            description: 'Síguenos en nuestras redes sociales para no perderte ninguna novedad.',
          },
        },
      ],
    }).drive();
  }
}
