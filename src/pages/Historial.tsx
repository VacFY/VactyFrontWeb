import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { esErrorDeConexion, mensajeDeError } from '../api/http';
import { Aparecer, Numero, Seccion, Titulo } from '../components/Animados';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import { GraficoTemperatura } from '../components/GraficoTemperatura';
import { useDni } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { aInputFechaHora, formatoFechaHora, formatoHora, formatoHumedad, formatoTemp } from '../lib/format';
import {
  agruparPorIntervalo,
  MINUTOS_POR_INTERVALO,
  obtenerLecturasDelRango,
  resumirHistorial,
  type Intervalo,
} from '../lib/lecturas';
import { claveUsuario, guardarCache, leerCache } from '../lib/storage';

type Preset = '8h' | '24h' | '72h' | 'personalizado';
const HORAS: Record<Exclude<Preset, 'personalizado'>, number> = { '8h': 8, '24h': 24, '72h': 72 };
const TEXTO_PRESET: Record<Preset, string> = {
  '8h': 'Últimas 8 horas',
  '24h': 'Últimas 24 horas',
  '72h': 'Últimos 3 días',
  personalizado: 'Elegir fechas',
};
const MAX_DIAS = 7;
const FILAS_POR_PAGINA = 48;

interface Consulta {
  desde: number;
  hasta: number;
  intervalos: Intervalo[];
  incompleto: boolean;
}

function validarFechas(desde: string, hasta: string): { desde?: string; hasta?: string } {
  const e: { desde?: string; hasta?: string } = {};
  if (!desde) e.desde = 'Elige la fecha y hora de inicio.';
  if (!hasta) e.hasta = 'Elige la fecha y hora de fin.';
  if (e.desde || e.hasta) return e;
  const d = new Date(desde).getTime();
  const h = new Date(hasta).getTime();
  if (Number.isNaN(d)) e.desde = 'La fecha no es válida.';
  if (Number.isNaN(h)) e.hasta = 'La fecha no es válida.';
  else if (h > Date.now() + 60_000) e.hasta = 'La fecha de fin no puede estar en el futuro.';
  if (!e.desde && !e.hasta) {
    if (d >= h) e.hasta = 'El fin debe ser posterior al inicio.';
    else if (h - d > MAX_DIAS * 86_400_000) e.hasta = `Consulta como máximo ${MAX_DIAS} días a la vez.`;
  }
  return e;
}

export function Historial() {
  const dni = useDni();
  const { termo, cargando: cargandoTermo } = useTermo();
  const [preset, setPreset] = useState<Preset>('8h');
  const [desdeTxt, setDesdeTxt] = useState(() => aInputFechaHora(new Date(Date.now() - 8 * 3_600_000)));
  const [hastaTxt, setHastaTxt] = useState(() => aInputFechaHora(new Date()));
  const [erroresFecha, setErroresFecha] = useState<{ desde?: string; hasta?: string }>({});
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desdeCache, setDesdeCache] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const control = useRef<AbortController | null>(null);

  const contenedor = termo?.contenedor;
  const clave = claveUsuario(dni, `historial:${contenedor}`);

  const consultar = useCallback(
    async (desde: Date, hasta: Date) => {
      if (!contenedor) return;
      control.current?.abort();
      const actual = new AbortController();
      control.current = actual;
      setCargando(true);
      setError(null);
      try {
        const { lecturas, incompleto } = await obtenerLecturasDelRango(contenedor, desde, hasta, actual.signal);
        const nueva: Consulta = {
          desde: desde.getTime(),
          hasta: hasta.getTime(),
          intervalos: agruparPorIntervalo(lecturas, desde.getTime(), hasta.getTime()),
          incompleto,
        };
        setConsulta(nueva);
        setDesdeCache(null);
        setPagina(0);
        guardarCache(clave, nueva);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        const cache = leerCache<Consulta>(clave);
        if (esErrorDeConexion(e) && cache) {
          setConsulta(cache.datos);
          setDesdeCache(cache.guardadoEn);
          setPagina(0);
        } else setError(mensajeDeError(e));
      } finally {
        if (control.current === actual) setCargando(false);
      }
    },
    [contenedor, clave],
  );

  useEffect(() => {
    if (preset === 'personalizado') return;
    const hasta = new Date();
    void consultar(new Date(hasta.getTime() - HORAS[preset] * 3_600_000), hasta);
  }, [preset, consultar]);

  useEffect(() => () => control.current?.abort(), []);

  function consultarPersonalizado(e: FormEvent) {
    e.preventDefault();
    const errores = validarFechas(desdeTxt, hastaTxt);
    setErroresFecha(errores);
    if (errores.desde || errores.hasta) return;
    void consultar(new Date(desdeTxt), new Date(hastaTxt));
  }

  function actualizar() {
    if (preset === 'personalizado') return;
    const hasta = new Date();
    void consultar(new Date(hasta.getTime() - HORAS[preset] * 3_600_000), hasta);
  }

  const resumen = useMemo(
    () => (consulta && termo ? resumirHistorial(consulta.intervalos, termo) : null),
    [consulta, termo],
  );
  const filas = useMemo(() => (consulta ? [...consulta.intervalos].reverse() : []), [consulta]);

  if (cargandoTermo && !termo) return <p className="cargando">Cargando…</p>;
  if (!termo)
    return (
      <>
        <Titulo>Historial de temperatura</Titulo>
        <Aviso tipo="info">
          Primero <Link to="/termo">registra tu termo</Link> para ver su historial.
        </Aviso>
      </>
    );

  const paginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA));
  const visibles = filas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA);
  const conFecha = consulta ? consulta.hasta - consulta.desde > 86_400_000 : false;

  return (
    <>
      <Titulo>Historial de temperatura</Titulo>
      <p className="subtitulo">
        El sensor registra la temperatura automáticamente. Aquí la ves resumida cada {MINUTOS_POR_INTERVALO} minutos.
      </p>

      <Seccion as="section" className="barra-filtros">
        <div className="segmentos" role="radiogroup" aria-label="Periodo">
          {(Object.keys(TEXTO_PRESET) as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={preset === p}
              className={`segmento${preset === p ? ' segmento--activo' : ''}`}
              onClick={() => setPreset(p)}
            >
              {TEXTO_PRESET[p]}
            </button>
          ))}
        </div>

        {preset === 'personalizado' ? (
          <form className="fila-campos fila-campos--abajo" onSubmit={consultarPersonalizado} noValidate>
            <Campo id="desde" etiqueta="Desde" error={erroresFecha.desde}>
              <input {...ariaCampo('desde', erroresFecha.desde)} type="datetime-local" value={desdeTxt} onChange={(e) => setDesdeTxt(e.target.value)} />
            </Campo>
            <Campo id="hasta" etiqueta="Hasta" error={erroresFecha.hasta}>
              <input
                {...ariaCampo('hasta', erroresFecha.hasta)}
                type="datetime-local"
                value={hastaTxt}
                max={aInputFechaHora(new Date())}
                onChange={(e) => setHastaTxt(e.target.value)}
              />
            </Campo>
            <button type="submit" className="boton boton--primario" disabled={cargando}>
              Consultar
            </button>
          </form>
        ) : (
          <button type="button" className="boton boton--borde" onClick={actualizar} disabled={cargando}>
            {cargando ? 'Consultando…' : 'Actualizar'}
          </button>
        )}
      </Seccion>

      {cargando && <p className="cargando">Consultando lecturas…</p>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {desdeCache && consulta && (
        <Aviso tipo="alerta">
          Sin conexión: se muestra la última consulta guardada ({formatoFechaHora(consulta.desde)} a{' '}
          {formatoFechaHora(consulta.hasta)}), guardada el {formatoFechaHora(desdeCache)}.
        </Aviso>
      )}
      {consulta?.incompleto && (
        <Aviso tipo="info">Hubo demasiadas lecturas en algunos tramos; el resumen usa las primeras que entregó el servidor.</Aviso>
      )}

      {consulta && resumen && (
        <>
          <section className="cifras" aria-label="Resumen del periodo">
            <div className="cifra">
              <span className="cifra__valor"><Numero valor={resumen.promedio} decimales={1} sufijo=" °C" /></span>
              <span className="cifra__nombre">Promedio</span>
            </div>
            <div className="cifra">
              <span className="cifra__valor"><Numero valor={resumen.min} decimales={1} sufijo=" °C" /></span>
              <span className="cifra__nombre">Mínima</span>
            </div>
            <div className="cifra">
              <span className="cifra__valor"><Numero valor={resumen.max} decimales={1} sufijo=" °C" /></span>
              <span className="cifra__nombre">Máxima</span>
            </div>
            <div className="cifra">
              <span className="cifra__valor">
                <Numero valor={resumen.porcentajeEnRango == null ? null : Math.round(resumen.porcentajeEnRango)} sufijo=" %" />
              </span>
              <span className="cifra__nombre">Tiempo en rango</span>
            </div>
            <div className="cifra">
              <span className="cifra__valor"><Numero valor={Math.round(resumen.cobertura)} sufijo=" %" /></span>
              <span className="cifra__nombre">Registro completo</span>
            </div>
            <div className="cifra">
              <span className="cifra__valor"><Numero valor={resumen.intervalosSinDatos} /></span>
              <span className="cifra__nombre">Intervalos sin datos</span>
            </div>
          </section>

          <Aparecer>
          <Seccion as="section">
            <h2>Gráfico</h2>
            {resumen.lecturasValidas > 0 ? (
              <GraficoTemperatura
                puntos={consulta.intervalos.map((i) => ({ t: i.inicio, temperatura: i.promedio }))}
                min={termo.min}
                max={termo.max}
                conFecha={conFecha}
                animar
              />
            ) : (
              <p className="vacio">No hay lecturas en este periodo.</p>
            )}
            <p className="campo__ayuda">Los cortes en la línea son periodos sin lecturas (sensor apagado o sin señal).</p>
          </Seccion>
          </Aparecer>

          {resumen.lecturasValidas > 0 && (
          <Aparecer orden={1}>
          <Seccion as="section">
            <h2>Registro cada {MINUTOS_POR_INTERVALO} minutos</h2>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">Intervalo</th>
                    <th scope="col">Promedio</th>
                    <th scope="col">Mín.</th>
                    <th scope="col">Máx.</th>
                    <th scope="col">Humedad</th>
                    <th scope="col">Lecturas</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((i) => {
                    const fuera = i.cantidad > 0 && ((i.min as number) < termo.min || (i.max as number) > termo.max);
                    return (
                      <tr key={i.inicio} className={i.cantidad === 0 ? 'fila--sin-datos' : fuera ? 'fila--fuera' : undefined}>
                        <td>
                          {conFecha && `${new Date(i.inicio).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} `}
                          {formatoHora(i.inicio)}–{formatoHora(i.inicio + MINUTOS_POR_INTERVALO * 60_000)}
                        </td>
                        <td>{formatoTemp(i.promedio)}</td>
                        <td>{formatoTemp(i.min)}</td>
                        <td>{formatoTemp(i.max)}</td>
                        <td>{formatoHumedad(i.humedad)}</td>
                        <td>{i.cantidad}</td>
                        <td>{i.cantidad === 0 ? 'Sin datos' : fuera ? 'Fuera de rango' : 'En rango'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <nav className="paginacion" aria-label="Páginas del registro">
                <button type="button" className="boton boton--borde boton--chico" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
                  Más recientes
                </button>
                <span>
                  Página {pagina + 1} de {paginas}
                </span>
                <button
                  type="button"
                  className="boton boton--borde boton--chico"
                  disabled={pagina >= paginas - 1}
                  onClick={() => setPagina(pagina + 1)}
                >
                  Más antiguos
                </button>
              </nav>
            )}
          </Seccion>
          </Aparecer>
          )}
        </>
      )}
    </>
  );
}
