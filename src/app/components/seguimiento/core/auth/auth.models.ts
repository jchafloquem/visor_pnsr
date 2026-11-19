export type UnidadOperativa = 'UTP' | 'PIASAR' | 'AMAZONÍA RURAL';

export type AreaUsuario = UnidadOperativa | 'UPP' | 'DE';

export type RolUsuario = 'reg' | 'upp' | 'dir';

export interface Usuario {
  id: string;
  nombre: string;
  cargo: string;
  area: AreaUsuario;
  sub: string;
  rol: RolUsuario;
  valida?: boolean;
  oculto?: boolean;
}
