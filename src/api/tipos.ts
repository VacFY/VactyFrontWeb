export type Rol = 'ENFERMERA' | 'SUPERVISOR';

export interface Perfil {
  profileDni: string;
  profileName: string;
  profileLastName: string;
  profileCompany: string;
  role: Rol;
}

// ── Termos ─────────────────────────────────────────────────────
export type EstadoTermo = 'OK' | 'ALERTA' | 'SIN_DATOS';

export interface RangoTermo {
  minTemp: number;
  maxTemp: number;
  /** LOTS = calculado con los lotes activos; PROFILE = perfil asignado o el estándar 2–8 °C. */
  basedOn: 'LOTS' | 'PROFILE';
  profileName: string | null;
  freezeSensitive: boolean;
  heatSensitive: boolean;
}

export interface ProximoVencimiento {
  lotId: number;
  vaccine: string;
  lotNumber: string;
  expiryDate: string;
  daysToExpiry: number;
}

export interface AsignadoA {
  userId: string;
  dni: string;
  nombre: string | null;
  desde: string;
}

/**
 * Termo con su estado. La enfermera recibe los suyos (GET /my/containers, con `asignadoDesde`);
 * el supervisor, todos (GET /containers, con `registrado`, `activo` y `asignadoA`).
 */
export interface Termo {
  contenedor: string;
  nombre: string | null;
  asignadoDesde?: string | null;
  registrado?: boolean;
  activo?: boolean;
  asignadoA?: AsignadoA | null;
  status: EstadoTermo;
  temperatura: number | null;
  humedad: number | null;
  lastReadingAt: string | null;
  range: RangoTermo;
  activeLots: number;
  expiredLots: number;
  nextExpiry: ProximoVencimiento | null;
  openAlerts: number;
  highestSeverity: SeveridadAlerta | null;
}

/** Respuesta al registrar un termo o regenerar su clave: la clave solo se muestra esta vez. */
export interface ClaveTermo {
  codigo: string;
  nombre: string;
  clave: string;
  activo: boolean;
  creadoEn: string;
}

export interface ResultadoVinculo {
  contenedor: string;
  nombre: string | null;
  asignadoDesde: string;
  nuevaAsignacion: boolean;
}

export type MotivoCierre = 'ENTREGADO' | 'TOMADO_POR_OTRA' | 'DESVINCULADO_POR_SUPERVISOR';

export interface Asignacion {
  id: number;
  contenedor: string;
  userId: string;
  persona: { userId: string; dni: string; nombre: string | null } | null;
  desde: string;
  hasta: string | null;
  motivoCierre: MotivoCierre | null;
}

// ── Vacunas y lotes ────────────────────────────────────────────
export interface Vacuna {
  id: number;
  name: string;
  protectsAgainst: string | null;
  minTemp: number;
  maxTemp: number;
  freezeSensitive: boolean;
  heatSensitive: boolean;
  dosesPerVial: number | null;
  notes: string | null;
  verified: boolean;
  careProfile: string | null;
  careProfileLabel: string | null;
  careInstructions: string[];
}

export type EstadoLoteApi = 'ACTIVE' | 'USED' | 'DISCARDED' | 'EXPIRED';
export type OrigenLote = 'SCAN' | 'TYPED_CODE' | 'MANUAL';

export interface LoteApi {
  id: number;
  contenedor: string;
  vaccine: Vacuna;
  gtin: string | null;
  lotNumber: string;
  /** "AAAA-MM-DD". */
  expiryDate: string;
  daysToExpiry: number;
  vials: number;
  doses: number | null;
  source: OrigenLote;
  status: EstadoLoteApi;
  registeredBy: string;
  registeredAt: string;
  closedAt: string | null;
  closeReason: string | null;
}

/** POST /lots/read: lo que se entendió del código, sin guardar nada. */
export interface LecturaCodigo {
  gtin: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  serial: string | null;
  daysToExpiry: number | null;
  vaccine: Vacuna | null;
  knownProduct: boolean;
  warnings: string[];
}

export interface NuevoLote {
  contenedor: string;
  vaccineId: number;
  lotNumber: string;
  expiryDate: string;
  vials: number;
  doses: number | null;
  gtin: string | null;
  source: OrigenLote;
}

// ── Alertas ────────────────────────────────────────────────────
export type TipoAlerta =
  | 'OUT_OF_RANGE'
  | 'RAPID_CHANGE'
  | 'SENSOR_OFFLINE'
  | 'INVALID_READING'
  | 'LOT_EXPIRING'
  | 'LOT_EXPIRED';
export type SeveridadAlerta = 'WARNING' | 'CRITICAL';
export type EstadoAlerta = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type FiltroAlertas = 'OPEN' | EstadoAlerta | 'ALL';

export interface LoteAfectado {
  lotId: number;
  vaccine: string;
  lotNumber: string;
  expiryDate: string;
}

export interface Alerta {
  id: number;
  contenedor: string;
  type: TipoAlerta;
  severity: SeveridadAlerta;
  status: EstadoAlerta;
  title: string;
  message: string;
  affectedLots: LoteAfectado[];
  /** Lote de una alerta de vencimiento (para "Descartar"); null en las de temperatura. */
  lotId: number | null;
  triggerValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  startedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolutionMessage: string | null;
}

/** Aviso de /ws/alerts (los mensajes con `id` son alertas). */
export interface AvisoAsignacion {
  tipo: 'ASIGNACION_CAMBIADA';
  contenedor: string;
}

// ── Lecturas ───────────────────────────────────────────────────
export interface Lectura {
  id: number;
  contenedor: string;
  temperatura: number | null;
  humedad: number | null;
  receivedAt: string;
}

/** Mensaje de /ws/device. */
export interface LecturaEnVivo {
  contenedor: string;
  temperatura: number | null;
  humedad: number | null;
}
