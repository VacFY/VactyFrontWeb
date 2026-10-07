import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { esErrorDeConexion, mensajeDeError } from '../api/http';
import { cerrarLote, listarAlertas } from '../api/servicios';
import type { Alerta, FiltroAlertas } from '../api/tipos';
import { Aparecer, Numero, Titulo } from '../components/Animados';
import { Aviso, Campo } from '../components/Campo';
import HoldButton from '../components/reactbits/HoldButton/HoldButton';
import { Leyenda } from '../components/Siglas';
import { useDni } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import {
  cumpleFiltro,
  guiaAlerta,
  iconoTipo,
  ordenarAlertas,
  TEXTO_ESTADO_ALERTA,
  TEXTO_FILTRO_ALERTAS,
  textoTipo,
} from '../lib/alertas';
import { formatoFecha, formatoFechaHora, formatoTemp } from '../lib/format';
import { siglasEnTexto } from '../lib/siglas';
import { claveUsuario, guardarCache, leerCache } from '../lib/storage';
import { nombreTermo, rangoDe } from '../lib/termo';

function ItemAlerta({ alerta, orden, onCambio }: { alerta: Alerta; orden: number; onCambio(): void }) {
  const { marcarVista } = useTiempoReal();
  const { termos, recargarPronto } = useTermo();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'info' | 'exito'; texto: string } | null>(null);
  const critica = alerta.severity === 'CRITICAL';
  const termo = termos.find((t) => t.contenedor === alerta.contenedor);
  const guia = guiaAlerta(alerta, rangoDe(termo).minTemp);

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

  async function descartar() {
    if (alerta.lotId == null) return;
    setMensaje(null);
    try {
      const lote = await cerrarLote(alerta.lotId, 'DISCARDED', alerta.type === 'LOT_EXPIRED' ? 'Vencido' : 'Descartado desde la alerta');
      setMensaje({ tipo: 'exito', texto: `Lote ${lote.lotNumber} de ${lote.vaccine.name} descartado.` });
      recargarPronto();
      onCambio();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(e) });
    }
  }

  return (
    <Aparecer
      as="li"
      orden={orden}
      className={`evento evento--${alerta.status.toLowerCase()}${critica ? ' evento--critica' : ''}`}
    >
      <span className="evento__nodo" aria-hidden="true">
        {iconoTipo(alerta.type)}
      </span>
      <div className="evento__cuerpo">
        <p className="evento__hora">
          <time dateTime={alerta.startedAt}>{formatoFechaHora(alerta.startedAt)}</time>
          <span className={`chip ${critica ? 'chip--peligro' : 'chip--alerta'}`}>{critica ? 'Crítica' : 'Advertencia'}</span>
          <span className={`chip chip--estado-${alerta.status.toLowerCase()}`}>{TEXTO_ESTADO_ALERTA[alerta.status]}</span>
          <span className="evento__termo">{termo ? nombreTermo(termo) : `Termo ${alerta.contenedor}`}</span>
        </p>
        <h2 className="evento__titulo">{alerta.title || textoTipo(alerta.type)}</h2>
        <p className="evento__mensaje">{alerta.message}</p>

        {alerta.affectedLots?.length > 0 && (
          <ul className="evento__lotes" aria-label="Lotes afectados">
            {alerta.affectedLots.map((l) => (
              <li key={l.lotId}>
                <strong>{l.vaccine}</strong> lote {l.lotNumber} · vence el {formatoFecha(l.expiryDate)}
              </li>
            ))}
          </ul>
        )}

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

        {alerta.status !== 'RESOLVED' && guia && (
          <p className="evento__guia">
            <strong>Qué hacer:</strong> {guia}
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
        {alerta.status !== 'RESOLVED' && (
          <div className="acciones">
            {alerta.status === 'ACTIVE' && (
              <button type="button" className="boton boton--primario" onClick={marcar} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Marcar como vista'}
              </button>
            )}
            {alerta.lotId != null && (
              <HoldButton
                size="md"
                radius={12}
                holdTime={1200}
                backgroundColor="#ffffff"
                fillColor="#b42318"
                textColor="#390f07"
                fillTextColor="#ffffff"
                doneLabel="Descartado"
                resetAfter={1500}
                onHold={() => void descartar()}
                className="boton-mantener"
              >
                Mantén para descartar el lote
              </HoldButton>
            )}
          </div>
        )}
      </div>
    </Aparecer>
  );
}

export function Alertas() {
  const dni = useDni();
  const { termos } = useTermo();
  const { alertasEnVivo } = useTiempoReal();
  const [filtro, setFiltro] = useState<FiltroAlertas>('OPEN');
  const [contenedor, setContenedor] = useState('');
  const [lista, setLista] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desdeCache, setDesdeCache] = useState<string | null>(null);

  const clave = claveUsuario(dni, `alertas:${contenedor || 'todos'}:${filtro}`);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarAlertas(filtro, contenedor || undefined);
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
    for (const a of alertasEnVivo) if (!contenedor || a.contenedor === contenedor) porId.set(a.id, a);
    return ordenarAlertas([...porId.values()].filter((a) => cumpleFiltro(a, filtro)));
  }, [lista, alertasEnVivo, filtro, contenedor]);

  const activas = alertas.filter((a) => a.status === 'ACTIVE').length;
  const criticas = alertas.filter((a) => a.severity === 'CRITICAL' && a.status !== 'RESOLVED').length;
  const siglas = siglasEnTexto(...alertas.map((a) => a.message));

  return (
    <>
      <Titulo>Alertas</Titulo>
      <p className="subtitulo">
        Lo que pasó con la temperatura y los lotes de {termos.length === 1 ? nombreTermo(termos[0]) : 'tus termos'}.
      </p>

      {termos.length === 0 && (
        <Aviso tipo="info">
          Aún no tienes termos. <Link to="/termos">Ve a Termos</Link> para vincular o registrar uno.
        </Aviso>
      )}

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
        {termos.length > 1 && (
          <Campo id="filtro-termo" etiqueta="Termo">
            <select id="filtro-termo" value={contenedor} onChange={(e) => setContenedor(e.target.value)}>
              <option value="">Todos</option>
              {termos.map((t) => (
                <option key={t.contenedor} value={t.contenedor}>
                  {nombreTermo(t)} ({t.contenedor})
                </option>
              ))}
            </select>
          </Campo>
        )}
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
          <ItemAlerta key={a.id} alerta={a} orden={i} onCambio={() => void cargar()} />
        ))}
      </ol>
      {alertas.length >= 200 && <p className="campo__ayuda">Se muestran las 200 alertas más recientes.</p>}

      <Leyenda siglas={siglas} />
    </>
  );
}
