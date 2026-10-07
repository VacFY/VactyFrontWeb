import { useCallback, useEffect, useState } from 'react';
import { SIN_DATOS_LOCALES, type DatosLocalesLote } from './lotes';
import { claveUsuario, guardar, leer } from './storage';

type PorLote = Record<number, DatosLocalesLote>;

/**
 * VVM, foto y verificaciones de cada lote. El backend no los guarda, así que viven en este
 * dispositivo (indexados por el id del lote) y se mantienen sincronizados entre pestañas.
 */
export function useDatosLocales(dni: string) {
  const clave = claveUsuario(dni, 'lotes-vvm');
  const [locales, setLocales] = useState<PorLote>(() => leer<PorLote>(clave, {}));

  useEffect(() => {
    setLocales(leer<PorLote>(clave, {}));
    const alCambiar = (e: StorageEvent) => {
      if (e.key === `vacty:${clave}`) setLocales(leer<PorLote>(clave, {}));
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [clave]);

  const de = useCallback((lotId: number): DatosLocalesLote => locales[lotId] ?? SIN_DATOS_LOCALES, [locales]);

  /** Devuelve false si el dispositivo no tiene espacio para guardar (p. ej. fotos muy pesadas). */
  const guardarLocal = useCallback(
    (lotId: number, datos: DatosLocalesLote): boolean => {
      const nuevos = { ...leer<PorLote>(clave, {}), [lotId]: datos };
      if (!guardar(clave, nuevos)) return false;
      setLocales(nuevos);
      return true;
    },
    [clave],
  );

  return { locales, de, guardarLocal };
}
