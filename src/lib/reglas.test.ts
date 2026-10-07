import { describe, expect, it } from 'vitest';
import { motivoDelServidor } from '../api/http';
import type { Alerta, LoteApi, Vacuna } from '../api/tipos';
import { usuarioDesdePerfil } from '../context/SesionContext';
import { guiaAlerta, suenaSirena } from './alertas';
import { agruparPorIntervalo, resumirHistorial } from './lecturas';
import { estadoLote, lotesUsarPrimero, ordenarFefo, SIN_DATOS_LOCALES, validarLote, verificarLote } from './lotes';
import { estadoTemperatura, RANGO_POR_DEFECTO, separarQr, validarClave, validarCodigoTermo } from './termo';
import { validarContrasena, validarDni, validarTextoPerfil } from './validacion';

describe('termos', () => {
  it('separa el código y la clave del QR del termo', () => {
    expect(separarQr('vacty:001:K75NGJ')).toEqual({ codigo: '001', clave: 'K75NGJ' });
    expect(separarQr('  VACTY:termo-2:k7p-29q ')).toEqual({ codigo: 'termo-2', clave: 'k7p-29q' });
    expect(separarQr('001')).toBeNull();
    expect(separarQr('https://vacty.pe/001')).toBeNull();
  });

  it('valida el código y la clave antes de enviarlos', () => {
    expect(validarCodigoTermo('001')).toBeNull();
    expect(validarCodigoTermo('termo_A-1')).toBeNull();
    expect(validarCodigoTermo('')).not.toBeNull();
    expect(validarCodigoTermo('con espacio')).not.toBeNull();
    expect(validarCodigoTermo('x'.repeat(33))).not.toBeNull();
    expect(validarClave('K7P-29Q')).toBeNull();
    expect(validarClave(' - ')).not.toBeNull();
  });

  it('distingue congelación de calor con el rango del backend', () => {
    expect(estadoTemperatura(1, RANGO_POR_DEFECTO)).toBe('congelacion');
    expect(estadoTemperatura(1, { ...RANGO_POR_DEFECTO, freezeSensitive: false })).toBe('bajo');
    expect(estadoTemperatura(9, RANGO_POR_DEFECTO)).toBe('alto');
    expect(estadoTemperatura(5, RANGO_POR_DEFECTO)).toBe('ok');
    expect(estadoTemperatura(null, RANGO_POR_DEFECTO)).toBe('sin_dato');
  });
});

describe('sesión y errores', () => {
  it('lee el rol y trata "Undefined" como perfil incompleto', () => {
    const nuevo = usuarioDesdePerfil({
      profileDni: '22222222',
      profileName: 'Undefined',
      profileLastName: 'Undefined',
      profileCompany: 'Undefined',
      role: 'ENFERMERA',
    });
    expect(nuevo).toEqual({ dni: '22222222', rol: 'ENFERMERA', nombre: null, perfilCompleto: false });
    const sup = usuarioDesdePerfil({
      profileDni: '11111111',
      profileName: 'Ana',
      profileLastName: 'Quispe',
      profileCompany: 'Microred',
      role: 'SUPERVISOR',
    });
    expect(sup).toMatchObject({ rol: 'SUPERVISOR', nombre: 'Ana Quispe', perfilCompleto: true });
  });

  it('usa el motivo que envía el backend y lo ignora si no viene', () => {
    expect(motivoDelServidor('{"status":403,"message":"No tiene acceso al termo 002: vincúlelo primero con su clave."}')).toBe(
      'No tiene acceso al termo 002: vincúlelo primero con su clave.',
    );
    expect(motivoDelServidor('{"status":500,"error":"Internal Server Error"}')).toBeNull();
    expect(motivoDelServidor('')).toBeNull();
    expect(motivoDelServidor('<html>')).toBeNull();
  });

  it('valida DNI, contraseña y datos del perfil', () => {
    expect(validarDni('12345678')).toBeNull();
    expect(validarDni('1234567')).not.toBeNull();
    expect(validarContrasena('clave123')).toBeNull();
    expect(validarContrasena('corta1')).not.toBeNull();
    expect(validarContrasena('solotexto')).not.toBeNull();
    expect(validarContrasena('a1'.repeat(40))).not.toBeNull();
    expect(validarTextoPerfil('Ana', 'nombre')).toBeNull();
    expect(validarTextoPerfil('  ', 'nombre')).not.toBeNull();
    expect(validarTextoPerfil('Undefined', 'nombre')).not.toBeNull();
  });
});

const alerta = (p: Partial<Alerta>): Alerta => ({
  id: 1,
  contenedor: '001',
  type: 'OUT_OF_RANGE',
  severity: 'WARNING',
  status: 'ACTIVE',
  title: '',
  message: '',
  affectedLots: [],
  lotId: null,
  triggerValue: null,
  minValue: null,
  maxValue: null,
  startedAt: '2026-10-07T12:00:00Z',
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolutionMessage: null,
  ...p,
});

describe('alertas', () => {
  it('la sirena suena por temperatura o sensor, no por vencimientos', () => {
    expect(suenaSirena(alerta({ type: 'OUT_OF_RANGE' }))).toBe(true);
    expect(suenaSirena(alerta({ type: 'SENSOR_OFFLINE' }))).toBe(true);
    expect(suenaSirena(alerta({ type: 'LOT_EXPIRING', severity: 'CRITICAL' }))).toBe(false);
    expect(suenaSirena(alerta({ type: 'LOT_EXPIRED', severity: 'CRITICAL' }))).toBe(false);
    expect(suenaSirena(alerta({ type: 'OUT_OF_RANGE', status: 'ACKNOWLEDGED' }))).toBe(false);
  });

  it('da una guía para temperatura y ninguna para lotes o tipos nuevos', () => {
    expect(guiaAlerta(alerta({ triggerValue: 1 }), 2)).toContain('paquetes fríos');
    expect(guiaAlerta(alerta({ type: 'LOT_EXPIRED' }), 2)).toBeNull();
    expect(guiaAlerta(alerta({ type: 'NUEVO_TIPO' as Alerta['type'] }), 2)).toBeNull();
  });
});

const HOY = '2026-10-07';
const vacuna = (id: number, name: string): Vacuna => ({
  id,
  name,
  protectsAgainst: null,
  minTemp: 2,
  maxTemp: 8,
  freezeSensitive: true,
  heatSensitive: false,
  dosesPerVial: null,
  notes: null,
  verified: false,
  careProfile: null,
  careProfileLabel: null,
  careInstructions: [],
});
const penta = vacuna(2, 'Pentavalente');
const lote = (p: Partial<LoteApi>): LoteApi => ({
  id: 1,
  contenedor: '001',
  vaccine: penta,
  gtin: null,
  lotNumber: 'L1',
  expiryDate: '2027-01-01',
  daysToExpiry: 86,
  vials: 10,
  doses: null,
  source: 'MANUAL',
  status: 'ACTIVE',
  registeredBy: 'x',
  registeredAt: '2026-10-01T00:00:00Z',
  closedAt: null,
  closeReason: null,
  ...p,
});

describe('lotes', () => {
  const datos = { vacunaId: '2', numero: 'ab-123', vencimiento: '2026-12-31', frascos: '10', dosis: '', etapaVvm: 1 as const };

  it('acepta un lote válido y rechaza los datos imposibles', () => {
    expect(validarLote(datos, HOY)).toEqual({});
    expect(validarLote({ ...datos, vencimiento: '2026-10-06' }, HOY).vencimiento).toContain('vencido');
    expect(validarLote({ ...datos, etapaVvm: 3 }, HOY).etapaVvm).toBeTruthy();
    expect(validarLote({ ...datos, vacunaId: '' }, HOY).vacunaId).toBeTruthy();
    expect(validarLote({ ...datos, frascos: '0' }, HOY).frascos).toBeTruthy();
    expect(validarLote({ ...datos, dosis: '0' }, HOY).dosis).toBeTruthy();
    expect(validarLote({ ...datos, numero: 'X'.repeat(21) }, HOY).numero).toBeTruthy();
  });

  it('clasifica por estado del backend, vencimiento y VVM local', () => {
    expect(estadoLote(lote({ status: 'EXPIRED' }), SIN_DATOS_LOCALES, 30, HOY)).toBe('vencido');
    expect(estadoLote(lote({ expiryDate: '2026-10-06' }), SIN_DATOS_LOCALES, 30, HOY)).toBe('vencido');
    expect(estadoLote(lote({ expiryDate: '2026-11-06' }), SIN_DATOS_LOCALES, 30, HOY)).toBe('por_vencer');
    expect(estadoLote(lote({ expiryDate: '2026-11-07' }), SIN_DATOS_LOCALES, 30, HOY)).toBe('vigente');
    expect(estadoLote(lote({}), { ...SIN_DATOS_LOCALES, etapaVvm: 4 }, 30, HOY)).toBe('no_apto');
  });

  it('ordena por FEFO y marca el primero apto de cada vacuna', () => {
    const a = lote({ id: 1, lotNumber: 'A', expiryDate: '2027-03-01' });
    const b = lote({ id: 2, lotNumber: 'B', expiryDate: '2026-12-01' });
    const c = lote({ id: 3, lotNumber: 'C', expiryDate: '2026-11-01' });
    const vencidoLote = lote({ id: 4, lotNumber: 'D', expiryDate: '2026-10-01', status: 'EXPIRED' });
    const otra = lote({ id: 5, lotNumber: 'H', vaccine: vacuna(3, 'Hepatitis B') });
    expect(ordenarFefo([a, b, vencidoLote]).map((l) => l.lotNumber)).toEqual(['D', 'B', 'A']);
    // C tiene el VVM en descarte en este equipo: se salta y se usa B.
    const locales = { 3: { ...SIN_DATOS_LOCALES, etapaVvm: 3 as const } };
    expect([...lotesUsarPrimero([a, b, c, vencidoLote, otra], locales, HOY)].sort()).toEqual([2, 5]);
  });

  it('la verificación bloquea frascos vencidos o con VVM en descarte', () => {
    expect(verificarLote(lote({}), 2, HOY).apto).toBe(true);
    expect(verificarLote(lote({}), 3, HOY).apto).toBe(false);
    expect(verificarLote(lote({ status: 'EXPIRED' }), 1, HOY).motivos).toHaveLength(1);
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
