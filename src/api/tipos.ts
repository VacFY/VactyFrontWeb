export interface Perfil {
  profileDni: string;
  profileName: string;
  profileLastName: string;
  profileCompany: string;
}

export interface Dispositivo {
  deviceId: string;
  deviceName: string;
  deviceConnectionAddress: string;
}

export interface PerfilVacuna {
  id: number;
  name: string;
  minTemp: number;
  maxTemp: number;
  freezeSensitive: boolean;
}

export type TipoAlerta = 'OUT_OF_RANGE' | 'RAPID_CHANGE' | 'SENSOR_OFFLINE' | 'INVALID_READING';
export type SeveridadAlerta = 'WARNING' | 'CRITICAL';
export type EstadoAlerta = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type FiltroAlertas = 'OPEN' | EstadoAlerta | 'ALL';

export interface Alerta {
  id: number;
  contenedor: string;
  type: TipoAlerta;
  severity: SeveridadAlerta;
  status: EstadoAlerta;
  message: string;
  triggerValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  startedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolutionMessage: string | null;
}

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
