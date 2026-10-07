import { Link } from 'react-router-dom';
import { Aparecer, Numero, Seccion, TemperaturaRodante, Titulo } from '../components/Animados';
import { Aviso } from '../components/Campo';
import { GraficoTemperatura } from '../components/GraficoTemperatura';
import Aurora from '../components/reactbits/Aurora/Aurora';
import ShinyText from '../components/reactbits/ShinyText/ShinyText';
import { DIAS_POR_VENCER, MS_SENSOR_SIN_SENAL } from '../config';
import { useDni } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import { TEXTO_ESTADO_ALERTA, TEXTO_TIPO_ALERTA } from '../lib/alertas';
import { esNumero, formatoFechaHora, formatoHumedad, formatoRango, formatoTemp, haceCuanto } from '../lib/format';
import { useAhora } from '../lib/hooks';
import { estadoLote } from '../lib/lotes';
import { estadoTemperatura, TEXTO_ESTADO_TEMPERATURA, type EstadoTemperatura } from '../lib/termo';
import { useLotes } from '../lib/useLotes';

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
  const dni = useDni();
  const { termo, cargando } = useTermo();
  const { ultima, serie, estadoSensor, alertasAbiertas } = useTiempoReal();
  const { lotes } = useLotes(dni);
  const ahora = useAhora(1000);

  if (cargando && !termo) return <p className="cargando">Cargando…</p>;

  if (!termo)
    return (
      <div className="vacio-grande">
        <Titulo>Aún no registras tu termo</Titulo>
        <p className="subtitulo">
          Registra el termo, el código de su sensor y las vacunas que lleva para ver su temperatura en vivo.
        </p>
        <Link to="/termo" className="boton boton--primario boton--grande">
          Registrar termo
        </Link>
      </div>
    );

  const estado = estadoTemperatura(ultima?.temperatura, termo);
  const sinSenal = !ultima || ahora - ultima.t > MS_SENSOR_SIN_SENAL;
  const clave: ClaveEstado = sinSenal ? 'sin_senal' : estado;
  const porVencer = lotes.filter((l) => estadoLote(l, DIAS_POR_VENCER) === 'por_vencer').length;
  const noUsables = lotes.filter((l) => ['vencido', 'no_apto'].includes(estadoLote(l, DIAS_POR_VENCER))).length;

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
              {termo.nombre} · sensor {termo.contenedor}
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

          <BarraRango temp={sinSenal ? null : ultima?.temperatura} min={termo.min} max={termo.max} />

          <dl className="hero__datos">
            <div>
              <dt>Rango seguro</dt>
              <dd>{formatoRango(termo.min, termo.max)}</dd>
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

          {termo.vacunas.length > 0 && (
            <ul className="hero__vacunas" aria-label="Vacunas que lleva">
              {termo.vacunas.map((v, i) => (
                <Aparecer as="li" key={v.nombre} orden={i + 2}>
                  {v.nombre}
                </Aparecer>
              ))}
            </ul>
          )}
        </div>
      </section>

      {termo.vacunas.length === 0 && (
        <Aviso tipo="alerta">
          Tu termo no tiene vacunas registradas. <Link to="/termo">Agrégalas</Link> para que las alarmas usen su rango.
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
          {alertasAbiertas.length === 0 ? (
            <p className="vacio vacio--ok">
              <span className="vacio__icono" aria-hidden="true">
                ✓
              </span>
              Todo en orden: no hay alertas abiertas.
            </p>
          ) : (
            <ol className="linea-tiempo linea-tiempo--compacta">
              {alertasAbiertas.slice(0, 4).map((a, i) => (
                <Aparecer
                  as="li"
                  key={a.id}
                  orden={i}
                  className={`linea-tiempo__item linea-tiempo__item--${a.status.toLowerCase()}${a.severity === 'CRITICAL' ? ' linea-tiempo__item--critica' : ''}`}
                >
                  <strong>{TEXTO_TIPO_ALERTA[a.type]}</strong>
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
          {lotes.length === 0 ? (
            <p className="vacio">Aún no registras lotes en el termo.</p>
          ) : (
            <div className="cifras">
              <div className="cifra cifra--alerta">
                <span className="cifra__valor">
                  <Numero valor={porVencer} />
                </span>
                <span className="cifra__nombre">por vencer en {DIAS_POR_VENCER} días</span>
              </div>
              <div className="cifra cifra--peligro">
                <span className="cifra__valor">
                  <Numero valor={noUsables} />
                </span>
                <span className="cifra__nombre">vencidos o no aptos</span>
              </div>
              <div className="cifra">
                <span className="cifra__valor">
                  <Numero valor={lotes.length} />
                </span>
                <span className="cifra__nombre">lotes en el termo</span>
              </div>
            </div>
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
          <GraficoTemperatura puntos={serie} min={termo.min} max={termo.max} />
        ) : (
          <p className="vacio">Todavía no hay suficientes lecturas para el gráfico.</p>
        )}
      </Seccion>
    </>
  );
}

