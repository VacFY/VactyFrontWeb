import { Link } from 'react-router-dom';
import { Aparecer, Numero, Seccion, TemperaturaRodante, Titulo } from '../components/Animados';
import { Aviso } from '../components/Campo';
import { GraficoTemperatura } from '../components/GraficoTemperatura';
import Aurora from '../components/reactbits/Aurora/Aurora';
import ShinyText from '../components/reactbits/ShinyText/ShinyText';
import { DIAS_POR_VENCER, MS_SENSOR_SIN_SENAL } from '../config';
import { useEsSupervisor } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import { TEXTO_ESTADO_ALERTA, textoTipo } from '../lib/alertas';
import { esNumero, formatoFecha, formatoFechaHora, formatoHumedad, formatoRango, formatoTemp, haceCuanto } from '../lib/format';
import { useAhora } from '../lib/hooks';
import {
  estadoTemperatura,
  nombreTermo,
  rangoDe,
  TEXTO_ESTADO_TEMPERATURA,
  textoRango,
  type EstadoTemperatura,
} from '../lib/termo';

const TEXTO_CONEXION = {
  conectado: 'Recibiendo en vivo',
  conectando: 'Conectando…',
  desconectado: 'Reconectando…',
} as const;

type ClaveEstado = EstadoTemperatura | 'sin_senal';

/** Colores de la aurora del fondo: el estado del termo se lee de un vistazo. */
const AURORA: Record<ClaveEstado, string[]> = {
  ok: ['#ffde59', '#3fae63', '#ffde59'],
  alto: ['#ff8a3d', '#e0281a', '#ffde59'],
  congelacion: ['#5fb4ff', '#1d5fa8', '#bfe3ff'],
  bajo: ['#5fb4ff', '#1d5fa8', '#bfe3ff'],
  sin_dato: ['#7a5247', '#b9a796', '#7a5247'],
  sin_senal: ['#7a5247', '#b9a796', '#7a5247'],
};

/** Barra tipo termómetro: dónde está la temperatura respecto al rango seguro. */
function BarraRango({ temp, min, max }: { temp: number | null | undefined; min: number; max: number }) {
  const desde = min - 6;
  const hasta = max + 6;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - desde) / (hasta - desde)) * 100));
  return (
    <div className="barra-rango" aria-hidden="true">
      <div className="barra-rango__pista">
        <span className="barra-rango__frio" style={{ width: `${pos(min)}%` }} />
        <span className="barra-rango__seguro" style={{ left: `${pos(min)}%`, width: `${pos(max) - pos(min)}%` }} />
        <span className="barra-rango__calor" style={{ left: `${pos(max)}%`, right: 0 }} />
        {esNumero(temp) && <span className="barra-rango__marca" style={{ left: `${pos(temp)}%` }} />}
      </div>
      <div className="barra-rango__etiquetas">
        <span style={{ left: '0%' }}>Congelación</span>
        <span style={{ left: `${pos(min)}%` }}>{min} °C</span>
        <span style={{ left: `${pos(max)}%` }}>{max} °C</span>
        <span style={{ left: '100%' }}>Calor</span>
      </div>
    </div>
  );
}

export function EnVivo() {
  const supervisor = useEsSupervisor();
  const { termo, cargando, error, recargar } = useTermo();
  const { ultima, serie, estadoSensor, alertasAbiertas } = useTiempoReal();
  const ahora = useAhora(1000);

  if (cargando && !termo) return <p className="cargando">Cargando…</p>;

  if (!termo && error)
    return (
      <>
        <Titulo>En vivo</Titulo>
        <Aviso tipo="error">{error}</Aviso>
        <button type="button" className="boton boton--primario" onClick={() => void recargar()}>
          Reintentar
        </button>
      </>
    );

  if (!termo)
    return (
      <div className="vacio-grande">
        <Titulo>{supervisor ? 'Aún no hay termos' : 'Aún no tienes un termo vinculado'}</Titulo>
        <p className="subtitulo">
          {supervisor
            ? 'Registra el termo con el código que envía su sensor y entrega la clave a la enfermera que lo llevará.'
            : 'Vincula el termo que llevas con el código y la clave impresos en su etiqueta para ver su temperatura en vivo.'}
        </p>
        <Link to="/termos" className="boton boton--primario boton--grande">
          {supervisor ? 'Registrar termo' : 'Vincular termo'}
        </Link>
      </div>
    );

  const rango = rangoDe(termo);
  const estado = estadoTemperatura(ultima?.temperatura, rango);
  const sinSenal = !ultima || ahora - ultima.t > MS_SENSOR_SIN_SENAL;
  const clave: ClaveEstado = sinSenal ? 'sin_senal' : estado;
  const abiertasDelTermo = alertasAbiertas.filter((a) => a.contenedor === termo.contenedor);
  const proximo = termo.nextExpiry;

  return (
    <>
      <section className={`hero hero--${clave}`} aria-label="Temperatura del termo" aria-live="polite">
        <div className="hero__fondo">
          <Aurora colorStops={AURORA[clave]} amplitude={1.1} blend={0.55} speed={0.6} />
        </div>
        <div className="hero__contenido">
          <p className="hero__vivo">
            <span className={`punto-estado punto-estado--${estadoSensor}`} aria-hidden="true" />
            {estadoSensor === 'conectado' ? (
              <ShinyText text={TEXTO_CONEXION.conectado} color="#fff3c2" shineColor="#ffffff" speed={2.4} />
            ) : (
              <span>{TEXTO_CONEXION[estadoSensor]}</span>
            )}
            <span className="hero__termo">
              {nombreTermo(termo)} · código {termo.contenedor}
            </span>
          </p>

          <div className="hero__temperatura">
            {esNumero(ultima?.temperatura) ? (
              <TemperaturaRodante valor={ultima.temperatura} color="#fffbea" />
            ) : (
              <span className="hero__vacia">— °C</span>
            )}
            <span className="solo-lectores">{formatoTemp(ultima?.temperatura)}</span>
          </div>
          <p className="hero__estado">{sinSenal ? 'Sensor sin señal' : TEXTO_ESTADO_TEMPERATURA[estado]}</p>

          <BarraRango temp={sinSenal ? null : ultima?.temperatura} min={rango.minTemp} max={rango.maxTemp} />

          <dl className="hero__datos">
            <div>
              <dt>Rango seguro</dt>
              <dd title={textoRango(rango)}>{formatoRango(rango.minTemp, rango.maxTemp)}</dd>
            </div>
            <div>
              <dt>Calculado con</dt>
              <dd>{rango.basedOn === 'LOTS' ? 'Los lotes del termo' : (rango.profileName ?? 'Perfil estándar')}</dd>
            </div>
            <div>
              <dt>Humedad</dt>
              <dd>{formatoHumedad(ultima?.humedad)}</dd>
            </div>
            <div>
              <dt>Última lectura</dt>
              <dd title={ultima ? formatoFechaHora(ultima.t) : undefined}>{ultima ? haceCuanto(ahora - ultima.t) : 'Aún no llegan lecturas'}</dd>
            </div>
          </dl>
        </div>
      </section>

      {termo.activeLots === 0 && (
        <Aviso tipo="info">
          El termo no tiene lotes registrados: las alarmas usan el rango {formatoRango(rango.minTemp, rango.maxTemp)}.{' '}
          <Link to="/lotes">Registra sus lotes</Link> para que el rango se ajuste a las vacunas que lleva.
        </Aviso>
      )}

      <div className="dos-columnas">
        <Seccion>
          <div className="seccion__cabecera">
            <h2>Alertas abiertas</h2>
            <Link to="/alertas" className="enlace-flecha">
              Ver todas
            </Link>
          </div>
          {abiertasDelTermo.length === 0 ? (
            <p className="vacio vacio--ok">
              <span className="vacio__icono" aria-hidden="true">
                ✓
              </span>
              Todo en orden: no hay alertas abiertas.
            </p>
          ) : (
            <ol className="linea-tiempo linea-tiempo--compacta">
              {abiertasDelTermo.slice(0, 4).map((a, i) => (
                <Aparecer
                  as="li"
                  key={a.id}
                  orden={i}
                  className={`linea-tiempo__item linea-tiempo__item--${a.status.toLowerCase()}${a.severity === 'CRITICAL' ? ' linea-tiempo__item--critica' : ''}`}
                >
                  <strong>{a.title || textoTipo(a.type)}</strong>
                  <span className="linea-tiempo__meta">
                    {TEXTO_ESTADO_ALERTA[a.status]} · desde {formatoFechaHora(a.startedAt)}
                  </span>
                </Aparecer>
              ))}
            </ol>
          )}
        </Seccion>

        <Seccion>
          <div className="seccion__cabecera">
            <h2>Lotes</h2>
            <Link to="/lotes" className="enlace-flecha">
              Ver lotes
            </Link>
          </div>
          {termo.activeLots === 0 && termo.expiredLots === 0 ? (
            <p className="vacio">Aún no hay lotes registrados en el termo.</p>
          ) : (
            <>
              <div className="cifras">
                <div className="cifra">
                  <span className="cifra__valor">
                    <Numero valor={termo.activeLots} />
                  </span>
                  <span className="cifra__nombre">lotes en el termo</span>
                </div>
                <div className="cifra cifra--peligro">
                  <span className="cifra__valor">
                    <Numero valor={termo.expiredLots} />
                  </span>
                  <span className="cifra__nombre">vencidos por descartar</span>
                </div>
              </div>
              {proximo && (
                <p className={proximo.daysToExpiry <= DIAS_POR_VENCER ? 'texto-peligro' : undefined}>
                  Vence primero: <strong>{proximo.vaccine}</strong> lote {proximo.lotNumber}, el{' '}
                  {formatoFecha(proximo.expiryDate)}.
                </p>
              )}
            </>
          )}
        </Seccion>
      </div>

      <Seccion>
        <div className="seccion__cabecera">
          <h2>Últimos 30 minutos</h2>
          <Link to="/historial" className="enlace-flecha">
            Ver historial
          </Link>
        </div>
        {serie.length > 1 ? (
          <GraficoTemperatura puntos={serie} min={rango.minTemp} max={rango.maxTemp} />
        ) : (
          <p className="vacio">Todavía no hay suficientes lecturas para el gráfico.</p>
        )}
      </Seccion>
    </>
  );
}

