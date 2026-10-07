import { useCallback, useEffect, useState } from 'react';
import type { Lote } from './lotes';
import { claveUsuario, guardar, leer } from './storage';

/**
 * Lotes del termo. El backend aún no tiene endpoints de lotes, así que se guardan en este
 * dispositivo (funcionan sin internet). Se mantienen sincronizados entre pestañas.
 */
export function useLotes(dni: string) {
  const clave = claveUsuario(dni, 'lotes');
  const [lotes, setLotes] = useState<Lote[]>(() => leer<Lote[]>(clave, []));

  useEffect(() => {
    setLotes(leer<Lote[]>(clave, []));
    const alCambiar = (e: StorageEvent) => {
      if (e.key === `vacty:${clave}`) setLotes(leer<Lote[]>(clave, []));
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [clave]);

  /** Devuelve false si el dispositivo no tiene espacio para guardar (p. ej. fotos muy pesadas). */
  const actualizar = useCallback(
    (fn: (actuales: Lote[]) => Lote[]): boolean => {
      const nuevos = fn(leer<Lote[]>(clave, []));
      if (!guardar(clave, nuevos)) return false;
      setLotes(nuevos);
      return true;
    },
    [clave],
  );

  return { lotes, actualizar };
}
