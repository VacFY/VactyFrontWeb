import { describe, expect, it } from 'vitest';
import { agruparPorIntervalo, resumirHistorial } from './lecturas';
import { estadoLote, lotesUsarPrimero, ordenarFefo, validarLote, verificarLote, type Lote } from './lotes';
import { codificarDireccion, decodificarDireccion, estadoTemperatura, nombrePerfil, vacunasDesdePerfil, type VacunaTermo } from './termo';
import { validarContrasena, validarDni, validarNuevaVacuna, validarRango } from './validacion';

const penta: VacunaTermo = { nombre: 'Pentavalente', min: 2, max: 8, sensibleCongelacion: true };
const neumo: VacunaTermo = { nombre: 'Neumococo conjugada', min: 2, max: 8, sensibleCongelacion: true };

describe('vacunas del termo', () => {
  it('acepta dos vacunas con el mismo rango', () => {
    expect(validarNuevaVacuna(neumo, [penta])).toBeNull();
  });

  it('rechaza una vacuna con otro rango y explica el motivo', () => {
    const otra = { nombre: 'Varicela', min: -50, max: -15, sensibleCongelacion: false };
    const error = validarNuevaVacuna(otra, [penta]);
    expect(error).toContain('Varicela');
    expect(error).toContain('Pentavalente');
    expect(error).toContain('mismo rango');
  });

  it('rechaza un rango que difiere solo en el máximo', () => {
    expect(validarNuevaVacuna({ ...neumo, max: 7.5 }, [penta])).not.toBeNull();
  });

  it('rechaza vacunas repetidas sin importar mayúsculas', () => {
    expect(validarNuevaVacuna({ ...penta, nombre: 'pentavalente' }, [penta])).toContain('ya está');
  });

  it('valida el rango de temperatura', () => {
    expect(validarRango('2', '8')).toMatchObject({ min: 2, max: 8, errorMin: undefined, errorMax: undefined });
    expect(validarRango('8', '2').errorMax).toBeTruthy();
    expect(validarRango('', '8').errorMin).toBeTruthy();
    expect(validarRango('2,5', '8').min).toBe(2.5);
    expect(validarRango('2.55', '8').errorMin).toBeTruthy();
    expect(validarRango('-60', '8').errorMin).toBeTruthy();
  });

  it('recupera las vacunas desde el perfil guardado en el backend', () => {
    const nombre = nombrePerfil([penta, neumo], 2, 8);
    const vacunas = vacunasDesdePerfil({ id: 3, name: `${nombre} #2`, minTemp: 2, maxTemp: 8, freezeSensitive: true });
    expect(vacunas.map((v) => v.nombre)).toEqual(['Pentavalente', 'Neumococo conjugada']);
    expect(vacunasDesdePerfil({ id: 1, name: 'PAI estándar 2–8 °C', minTemp: 2, maxTemp: 8, freezeSensitive: true })).toEqual([]);
  });

  it('codifica el contenedor y el perfil en el dispositivo', () => {
    expect(decodificarDireccion(codificarDireccion('001', 7))).toEqual({ contenedor: '001', profileId: 7 });
    expect(decodificarDireccion('192.168.1.50')).toEqual({ contenedor: '192.168.1.50', profileId: null });
  });

  it('distingue congelación de calor', () => {
    const rango = { min: 2, max: 8, sensibleCongelacion: true };
    expect(estadoTemperatura(1, rango)).toBe('congelacion');
    expect(estadoTemperatura(1, { ...rango, sensibleCongelacion: false })).toBe('bajo');
    expect(estadoTemperatura(9, rango)).toBe('alto');
    expect(estadoTemperatura(5, rango)).toBe('ok');
    expect(estadoTemperatura(null, rango)).toBe('sin_dato');
  });
});

describe('acceso', () => {
  it('valida DNI y contraseña', () => {
    expect(validarDni('12345678')).toBeNull();
    expect(validarDni('1234567')).not.toBeNull();
    expect(validarContrasena('clave123')).toBeNull();
    expect(validarContrasena('corta1')).not.toBeNull();
    expect(validarContrasena('solotexto')).not.toBeNull();
    expect(validarContrasena('a1'.repeat(40))).not.toBeNull();
  });
});

const HOY = '2026-10-07';
const lote = (p: Partial<Lote>): Lote => ({
  id: p.numero ?? 'x',
  vacuna: 'Pentavalente',
  numero: 'L1',
  vencimiento: '2027-01-01',
  frascos: 10,
  etapaVvm: 1,
  fotoVvm: null,
  registradoEn: '2026-10-01T00:00:00Z',
  verificaciones: [],
  ...p,
});

describe('lotes', () => {
  const datos = { vacuna: 'Pentavalente', numero: 'ab-123', vencimiento: '2026-12-31', frascos: '10', etapaVvm: 1 as const };
  const contexto = { vacunasTermo: ['Pentavalente'], lotes: [], hoy: HOY };

  it('acepta un lote válido', () => {
    expect(validarLote(datos, contexto)).toEqual({});
  });

  it('rechaza lotes vencidos, con VVM en descarte o de una vacuna que no está en el termo', () => {
    expect(validarLote({ ...datos, vencimiento: '2026-10-06' }, contexto).vencimiento).toContain('vencido');
    expect(validarLote({ ...datos, etapaVvm: 3 }, contexto).etapaVvm).toBeTruthy();
    expect(validarLote({ ...datos, vacuna: 'Varicela' }, contexto).vacuna).toBeTruthy();
    expect(validarLote({ ...datos, frascos: '0' }, contexto).frascos).toBeTruthy();
  });

  it('rechaza un lote repetido de la misma vacuna', () => {
    const existentes = [lote({ numero: 'AB-123' })];
    expect(validarLote(datos, { ...contexto, lotes: existentes }).numero).toBeTruthy();
  });

  it('clasifica por vencimiento y VVM', () => {
    expect(estadoLote(lote({ vencimiento: '2026-10-06' }), 30, HOY)).toBe('vencido');
    expect(estadoLote(lote({ vencimiento: '2026-10-07' }), 30, HOY)).toBe('por_vencer');
    expect(estadoLote(lote({ vencimiento: '2026-11-06' }), 30, HOY)).toBe('por_vencer');
    expect(estadoLote(lote({ vencimiento: '2026-11-07' }), 30, HOY)).toBe('vigente');
    expect(estadoLote(lote({ etapaVvm: 4 }), 30, HOY)).toBe('no_apto');
  });

  it('ordena por FEFO y marca el primero apto de cada vacuna', () => {
    const a = lote({ numero: 'A', vencimiento: '2027-03-01' });
    const b = lote({ numero: 'B', vencimiento: '2026-12-01' });
    const vencido = lote({ numero: 'C', vencimiento: '2026-10-01' });
    expect(ordenarFefo([a, b, vencido]).map((l) => l.numero)).toEqual(['C', 'B', 'A']);
    expect([...lotesUsarPrimero([a, b, vencido], HOY)]).toEqual(['B']);
  });

  it('la verificación bloquea frascos vencidos o con VVM en descarte', () => {
    expect(verificarLote(lote({}), 2, HOY).apto).toBe(true);
    expect(verificarLote(lote({}), 3, HOY).apto).toBe(false);
    expect(verificarLote(lote({ vencimiento: '2026-10-01' }), 1, HOY).motivos).toHaveLength(1);
  });
});

describe('historial cada 5 minutos', () => {
  const t0 = Date.UTC(2026, 9, 7, 12, 0);
  const lectura = (min: number, temperatura: number | null) => ({
    temperatura,
    humedad: 50,
    receivedAt: new Date(t0 + min * 60_000).toISOString(),
  });

  it('agrupa, deja huecos sin datos y calcula el resumen', () => {
    const intervalos = agruparPorIntervalo(
      [lectura(0, 5), lectura(1, 7), lectura(11, 9), lectura(12, null)],
      t0,
      t0 + 15 * 60_000,
    );
    expect(intervalos).toHaveLength(3);
    expect(intervalos[0]).toMatchObject({ promedio: 6, min: 5, max: 7, cantidad: 2 });
    expect(intervalos[1].cantidad).toBe(0);
    expect(intervalos[2]).toMatchObject({ promedio: 9, cantidad: 1 });

    const r = resumirHistorial(intervalos, { min: 2, max: 8 });
    expect(r.intervalosSinDatos).toBe(1);
    expect(r.intervalosFueraDeRango).toBe(1);
    expect(r.porcentajeEnRango).toBe(50);
    expect(Math.round(r.cobertura)).toBe(67);
  });
});
