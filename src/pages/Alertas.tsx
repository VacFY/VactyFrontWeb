import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { esErrorDeConexion, mensajeDeError } from '../api/http';
import { listarAlertas } from '../api/servicios';
import type { Alerta, FiltroAlertas } from '../api/tipos';
import { Aparecer, Numero, Titulo } from '../components/Animados';
import { Aviso } from '../components/Campo';
import { Leyenda } from '../components/Siglas';
import { useDni } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import {
  cumpleFiltro,
  guiaAlerta,
  ordenarAlertas,
  TEXTO_ESTADO_ALERTA,
  TEXTO_FILTRO_ALERTAS,
  TEXTO_TIPO_ALERTA,
} from '../lib/alertas';
import { formatoFechaHora, formatoTemp } from '../lib/format';
import { siglasEnTexto } from '../lib/siglas';
import { claveUsuario, guardarCache, leerCache } from '../lib/storage';

const ICONO_TIPO: Record<Alerta['type'], string> = {
  OUT_OF_RANGE: '🌡',
  RAPID_CHANGE: '↕',
  SENSOR_OFFLINE: '⦸',
  INVALID_READING: '?',
};

function ItemAlerta({ alerta, rangoMin, orden }: { alerta: Alerta; rangoMin: number; orden: number }) {
  const { marcarVista } = useTiempoReal();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'info'; texto: string } | null>(null);
  const critica = alerta.severity === 'CRITICAL';

  async function marcar() {
    setEnviando(true);
    setMensaje(null);
    try {
      const r = await marcarVista(alerta.id);
      if (r === 'pendiente') setMensaje({ tipo: 'info', texto: 'Sin internet: se enviará al volver la conexión.' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(e) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Aparecer
      as="li"
      orden={orden}
      className={`evento evento--${alerta.status.toLowerCase()}${critica ? ' evento--critica' : ''}`}
    >
      <span className="evento__nodo" aria-hidden="true">
        {ICONO_TIPO[alerta.type]}
      </span>
      <div className="evento__cuerpo">
        <p className="evento__hora">
          <time dateTime={alerta.startedAt}>{formatoFechaHora(alerta.startedAt)}</time>
          <span className={`chip ${critica ? 'chip--peligro' : 'chip--alerta'}`}>{critica ? 'Crítica' : 'Advertencia'}</span>
          <span className={`chip chip--estado-${alerta.status.toLowerCase()}`}>{TEXTO_ESTADO_ALERTA[alerta.status]}</span>
        </p>
        <h2 className="evento__titulo">{TEXTO_TIPO_ALERTA[alerta.type]}</h2>
        <p className="evento__mensaje">{alerta.message}</p>

        {(alerta.triggerValue != null || alerta.minValue != null || alerta.maxValue != null) && (
          <p className="evento__cifras">
            {alerta.triggerValue != null && (
              <span>
                <small>La abrió</small>
                {formatoTemp(alerta.triggerValue)}
              </span>
            )}
            {alerta.minValue != null && (
              <span>
                <small>Mínima</small>
                {formatoTemp(alerta.minValue)}
              </span>
            )}
            {alerta.maxValue != null && (
              <span>
                <small>Máxima</small>
                {formatoTemp(alerta.maxValue)}
              </span>
            )}
          </p>
        )}

        {alerta.status !== 'RESOLVED' && (
          <p className="evento__guia">
            <strong>Qué hacer:</strong> {guiaAlerta(alerta, rangoMin)}
          </p>
        )}

        {(alerta.acknowledgedAt || alerta.resolvedAt) && (
          <p className="evento__pie">
            {alerta.acknowledgedAt && <span>Vista el {formatoFechaHora(alerta.acknowledgedAt)}</span>}
            {alerta.resolvedAt && <span>Resuelta el {formatoFechaHora(alerta.resolvedAt)}</span>}
          </p>
        )}
        {alerta.resolutionMessage && <p className="evento__resolucion">✓ {alerta.resolutionMessage}</p>}
        {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
        {alerta.status === 'ACTIVE' && (
          <button type="button" className="boton boton--primario" onClick={marcar} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Marcar como vista'}
          </button>
        )}
      </div>
    </Aparecer>
  );
}

export function Alertas() {
  const dni = useDni();
  const { termo, cargando: cargandoTermo } = useTermo();
  const { alertasEnVivo } = useTiempoReal();
  const [filtro, setFiltro] = useState<FiltroAlertas>('OPEN');
  const [lista, setLista] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desdeCache, setDesdeCache] = useState<string | null>(null);

  const contenedor = termo?.contenedor;
  const clave = claveUsuario(dni, `alertas:${contenedor}:${filtro}`);

  const cargar = useCallback(async () => {
    if (!contenedor) return;
    setCargando(true);
    setError(null);
    try {
      const datos = await listarAlertas(filtro, contenedor);
      setLista(datos);
      setDesdeCache(null);
      guardarCache(clave, datos);
    } catch (e) {
      const cache = leerCache<Alerta[]>(clave);
      if (esErrorDeConexion(e) && cache) {
        setLista(cache.datos);
        setDesdeCache(cache.guardadoEn);
      } else {
        setLista([]);
        setError(mensajeDeError(e));
      }
    } finally {
      setCargando(false);
    }
  }, [contenedor, filtro, clave]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    const alVolver = () => void cargar();
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [cargar]);

  // Lo que llega en vivo reemplaza a lo consultado (es más reciente).
  const alertas = useMemo(() => {
    const porId = new Map(lista.map((a) => [a.id, a]));
    for (const a of alertasEnVivo) porId.set(a.id, a);
    return ordenarAlertas([...porId.values()].filter((a) => cumpleFiltro(a, filtro)));
  }, [lista, alertasEnVivo, filtro]);

  if (cargandoTermo && !termo) return <p className="cargando">Cargando…</p>;

  if (!termo)
    return (
      <>
        <Titulo>Alertas</Titulo>
        <Aviso tipo="info">
          Primero <Link to="/termo">registra tu termo</Link> para ver sus alertas.
        </Aviso>
      </>
    );

  const activas = alertas.filter((a) => a.status === 'ACTIVE').length;
  const criticas = alertas.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  const siglas = siglasEnTexto(...alertas.map((a) => a.message));

  return (
    <>
      <Titulo>Alertas</Titulo>
      <p className="subtitulo">
        Lo que pasó con la temperatura del termo {termo.nombre}. Rango seguro: {termo.min} a {termo.max} °C.
      </p>

      <div className="cifras cifras--cabecera">
        <div className="cifra cifra--peligro">
          <span className="cifra__valor">
            <Numero valor={activas} />
          </span>
          <span className="cifra__nombre">sin ver</span>
        </div>
        <div className="cifra cifra--peligro">
          <span className="cifra__valor">
            <Numero valor={criticas} />
          </span>
          <span className="cifra__nombre">críticas abiertas</span>
        </div>
        <div className="cifra">
          <span className="cifra__valor">
            <Numero valor={alertas.length} />
          </span>
          <span className="cifra__nombre">en esta vista</span>
        </div>
      </div>

      <div className="barra-filtros">
        <div className="segmentos" role="radiogroup" aria-label="Mostrar alertas">
          {(Object.keys(TEXTO_FILTRO_ALERTAS) as FiltroAlertas[]).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filtro === f}
              className={`segmento${filtro === f ? ' segmento--activo' : ''}`}
              onClick={() => setFiltro(f)}
            >
              {TEXTO_FILTRO_ALERTAS[f]}
            </button>
          ))}
        </div>
        <button type="button" className="boton boton--borde boton--chico" onClick={() => void cargar()} disabled={cargando}>
          <span className={cargando ? 'girando' : undefined} aria-hidden="true">
            ↻
          </span>
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {desdeCache && <Aviso tipo="alerta">Sin conexión: lista guardada el {formatoFechaHora(desdeCache)}.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}

      {!error && alertas.length === 0 && !cargando && (
        <p className="vacio vacio--ok">
          <span className="vacio__icono" aria-hidden="true">
            ✓
          </span>
          No hay alertas con este filtro.
        </p>
      )}
      <ol className="linea-tiempo">
        {alertas.map((a, i) => (
          <ItemAlerta key={a.id} alerta={a} rangoMin={termo.min} orden={i} />
        ))}
      </ol>
      {alertas.length >= 200 && <p className="campo__ayuda">Se muestran las 200 alertas más recientes.</p>}

      <Leyenda siglas={siglas} />
    </>
  );
}
