import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api/http';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import { guiaAlerta, suenaSirena, textoTipo } from '../lib/alertas';
import { formatoFechaHora } from '../lib/format';
import { useEnLinea } from '../lib/hooks';
import { SIGLAS, siglasEnTexto } from '../lib/siglas';
import { audioDisponible } from '../lib/sonido';
import { rangoDe } from '../lib/termo';

/** Aviso de modo sin internet y de sincronización al volver la conexión. */
export function BannerConexion() {
  const enLinea = useEnLinea();
  const { pendientes } = useTiempoReal();
  const { desdeCache } = useTermo();
  const [reconectado, setReconectado] = useState(false);
  const antes = useRef(enLinea);

  useEffect(() => {
    if (enLinea && !antes.current) {
      setReconectado(true);
      const id = window.setTimeout(() => setReconectado(false), 6000);
      antes.current = enLinea;
      return () => window.clearTimeout(id);
    }
    antes.current = enLinea;
  }, [enLinea]);

  const textoPendientes =
    pendientes === 1 ? '1 alerta marcada como vista se enviará' : `${pendientes} alertas marcadas como vistas se enviarán`;

  if (!enLinea)
    return (
      <div className="banda banda--sin-conexion" role="status">
        <strong>Sin internet.</strong> Ves los últimos datos guardados en este dispositivo
        {desdeCache ? ` (termo actualizado el ${formatoFechaHora(desdeCache)})` : ''}. Al volver la conexión, VacTy se
        sincroniza solo.
        {pendientes > 0 && ` ${textoPendientes} al reconectar.`}
      </div>
    );

  if (pendientes > 0)
    return (
      <div className="banda banda--sincronizando" role="status">
        Sincronizando: {textoPendientes}.
      </div>
    );

  if (reconectado)
    return (
      <div className="banda banda--exito" role="status">
        Conexión restablecida. Datos sincronizados.
      </div>
    );

  return null;
}

/** Alarma visible en todas las pantallas mientras haya una alerta activa sin ver. */
export function BannerAlarma() {
  const { alarma, marcarVista, sonido, cambiarSonido } = useTiempoReal();
  const { termos } = useTermo();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [alarma?.id]);

  if (!alarma) return null;
  const critica = alarma.severity === 'CRITICAL';
  const rango = rangoDe(termos.find((t) => t.contenedor === alarma.contenedor));
  const guia = guiaAlerta(alarma, rango.minTemp);
  const sirena = suenaSirena(alarma);

  async function marcar() {
    if (!alarma) return;
    setEnviando(true);
    setError(null);
    try {
      await marcarVista(alarma.id);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className={`alarma${critica ? ' alarma--critica' : ''}`} role="alert" aria-live="assertive">
      <div className="alarma__cuerpo">
        <p className="alarma__titulo">
          <span className="alarma__icono" aria-hidden="true">
            !
          </span>
          {critica ? 'ALERTA CRÍTICA' : 'ALERTA'} · {alarma.title || textoTipo(alarma.type)}
        </p>
        <p className="alarma__mensaje">{alarma.message}</p>
        {guia && (
          <p className="alarma__guia">
            <strong>Qué hacer:</strong> {guia}
          </p>
        )}
        {sirena && sonido && !audioDisponible() && (
          <p className="alarma__nota">Toca cualquier parte de la pantalla para que suene la alarma.</p>
        )}
        {siglasEnTexto(alarma.message).map((s) => (
          <p key={s} className="alarma__nota">
            {s}: {SIGLAS[s]}
          </p>
        ))}
        {error && <p className="alarma__nota">{error}</p>}
      </div>
      <div className="alarma__acciones">
        <button type="button" className="boton boton--claro" onClick={marcar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Marcar como vista'}
        </button>
        {sirena && (
          <button type="button" className="boton boton--borde-claro" onClick={() => cambiarSonido(!sonido)}>
            {sonido ? 'Silenciar sonido' : 'Activar sonido'}
          </button>
        )}
        <Link to="/alertas" className="boton boton--borde-claro">
          Ver alertas
        </Link>
      </div>
    </section>
  );
}
