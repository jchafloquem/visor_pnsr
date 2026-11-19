import { ParametrosSsp } from '../components/cartera/models/ssp.models';

export const SEED_PARAMS_DEF: ParametrosSsp = {
  P: {
    'Muy Alta': 0.9,
    Alta: 0.7,
    Moderada: 0.5,
    Baja: 0.3,
    'Muy Baja': 0.1,
  },
  I: {
    'Muy Bajo': 0.05,
    Bajo: 0.1,
    Moderado: 0.2,
    Alto: 0.4,
    'Muy Alto': 0.8,
  },
  cBaja: 0.05,
  cAlta: 0.18,
  dias: {
    UTP: { hito: 15, accion: 5 },
    PIASAR: { hito: 15, accion: 5 },
    'AMAZONÍA RURAL': { hito: 30, accion: 15 },
  },
  exc: {},
  cats: [
    'Diseño',
    'Climatológicos',
    'Sociales',
    'Legales y contractuales',
    'Constructivos',
    'Logísticos',
    'Arqueológicos',
    'Permisos y licencias',
    'Financieros',
    'Gestión y organización',
    'Interferencias',
    'Político',
    'Económico',
    'Ambiental',
  ],
};
