import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { esErrorDeConexion, mensajeDeError } from '../api/http';
import { cerrarLote, leerCodigo, listarVacunas, lotesDelTermo, lotesPorVencer, registrarLote } from '../api/servicios';
import type { LecturaCodigo, LoteApi, OrigenLote, Vacuna } from '../api/tipos';
import { Aparecer, Numero, Seccion, Titulo } from '../components/Animados';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import { IlustracionVvm } from '../components/IlustracionVvm';
import HoldButton from '../components/reactbits/HoldButton/HoldButton';
import StatusMark from '../components/reactbits/StatusMark/StatusMark';
import Stepper, { Step } from '../components/reactbits/Stepper/Stepper';
import { SelectorVvm } from '../components/SelectorVvm';
import { Leyenda, Sigla } from '../components/Siglas';
import { DIAS_POR_VENCER } from '../config';
import { useDni, useEsSupervisor } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { diasHasta, formatoFecha, formatoFechaHora, formatoRango, hoyISO } from '../lib/format';
import { useEnLinea } from '../lib/hooks';
import { comprimirFoto } from '../lib/imagen';
import {
  estadoLote,
  etapaActual,
  infoVvm,
  lotesUsarPrimero,
  normalizarNumeroLote,
  ordenarFefo,
  TEXTO_ESTADO_LOTE,
  ultimaVerificacion,
  validarLote,
  vencido,
  verificarLote,
  type DatosLocalesLote,
  type DatosLote,
  type ErroresLote,
  type EstadoLote,
  type EtapaVvm,
} from '../lib/lotes';
import { siglasEnTexto, type Sigla as ClaveSigla } from '../lib/siglas';
import { claveUsuario, guardarCache, leerCache } from '../lib/storage';
import { nombreTermo } from '../lib/termo';
import { useDatosLocales } from '../lib/useDatosLocales';

type Filtro = 'todos' | 'por_vencer' | 'vencido' | 'no_apto';
const TEXTO_FILTRO: Record<Filtro, string> = {
  todos: 'Todos',
  por_vencer: 'Por vencer',
  vencido: 'Vencidos',
  no_apto: 'No aptos',
};
const UMBRALES = [7, 15, 30, 60];
const SIN_ESPACIO = 'No hay espacio en este dispositivo para guardar el VVM. Quita la foto e inténtalo de nuevo.';

function textoVencimiento(vencimiento: string): string {
  const dias = diasHasta(vencimiento);
  if (dias < 0) return dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

/** Catálogo de vacunas del backend, guardado para abrir sin internet. */
function useVacunas(dni: string) {
  const clave = claveUsuario(dni, 'vacunas');
  const [vacunas, setVacunas] = useState<Vacuna[]>(() => leerCache<Vacuna[]>(clave)?.datos ?? []);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listarVacunas()
      .then((v) => {
        setVacunas(v);
        guardarCache(clave, v);
      })
      .catch((e) => setError(mensajeDeError(e)));
  }, [clave]);
  return { vacunas, error };
}

function CuidadosVacuna({ vacuna }: { vacuna: Vacuna }) {
  return (
    <div className="cuidados">
      <p>
        <strong>{vacuna.careProfileLabel ?? 'Cuidados'}</strong> · {formatoRango(vacuna.minTemp, vacuna.maxTemp)}
        {vacuna.freezeSensitive && ' · se daña si se congela'}
        {vacuna.heatSensitive && ' · sensible al calor'}
      </p>
      {vacuna.careInstructions.length > 0 && (
        <ul>
          {vacuna.careInstructions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {!vacuna.verified && <p className="campo__ayuda">Datos por verificar con la ficha técnica del fabricante.</p>}
    </div>
  );
}

function CampoFoto({ id, foto, onChange }: { id: string; foto: string | null; onChange(f: string | null): void }) {
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setProcesando(true);
    try {
      onChange(await comprimirFoto(archivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar la foto.');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Campo id={id} etiqueta={<>Foto del <Sigla s="VVM" /> (opcional)</>} error={error} ayuda="Sirve como evidencia del estado del frasco. Se guarda solo en este equipo.">
      {foto ? (
        <div className="foto">
          <img src={foto} alt="Foto del VVM" />
          <button type="button" className="boton boton--borde boton--chico" onClick={() => onChange(null)}>
            Quitar foto
          </button>
        </div>
      ) : (
        <input
          {...ariaCampo(id, error, true)}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={procesando}
          onChange={(e) => void elegir(e.target.files?.[0])}
        />
      )}
    </Campo>
  );
}

function FormularioLote({
  contenedor,
  onRegistrado,
  onCancelar,
}: {
  contenedor: string;
  onRegistrado(lote: LoteApi, local: DatosLocalesLote): void;
  onCancelar(): void;
}) {
  const dni = useDni();
  const enLinea = useEnLinea();
  const { vacunas, error: errorVacunas } = useVacunas(dni);
  const [codigo, setCodigo] = useState('');
  const [lectura, setLectura] = useState<LecturaCodigo | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [origen, setOrigen] = useState<OrigenLote>('MANUAL');
  const [datos, setDatos] = useState<DatosLote>({ vacunaId: '', numero: '', vencimiento: '', frascos: '', dosis: '', etapaVvm: null });
  const [foto, setFoto] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresLote>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = <K extends keyof DatosLote>(campo: K, valor: DatosLote[K]) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  async function leer() {
    if (!codigo.trim()) {
      setErrorCodigo('Escanea o escribe el código del frasco o de la caja.');
      return;
    }
    setLeyendo(true);
    setErrorCodigo(null);
    try {
      const r = await leerCodigo(codigo);
      setLectura(r);
      setOrigen(codigo.includes('(') ? 'TYPED_CODE' : 'SCAN');
      setDatos((d) => ({
        ...d,
        vacunaId: r.vaccine ? String(r.vaccine.id) : d.vacunaId,
        numero: r.lotNumber ?? d.numero,
        vencimiento: r.expiryDate ?? d.vencimiento,
      }));
      setErrores({});
    } catch (e) {
      setLectura(null);
      setErrorCodigo(mensajeDeError(e));
    } finally {
      setLeyendo(false);
    }
  }

  // Los escáneres terminan con Enter: se lee el código sin enviar el formulario.
  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void leer();
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = validarLote(datos);
    setErrores(nuevos);
    setErrorServidor(null);
    if (Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    try {
      const lote = await registrarLote({
        contenedor,
        vaccineId: Number(datos.vacunaId),
        lotNumber: normalizarNumeroLote(datos.numero),
        expiryDate: datos.vencimiento,
        vials: Number(datos.frascos),
        doses: datos.dosis.trim() ? Number(datos.dosis) : null,
        gtin: lectura?.gtin ?? null,
        source: lectura ? origen : 'MANUAL',
      });
      onRegistrado(lote, { etapaVvm: datos.etapaVvm, fotoVvm: foto, verificaciones: [] });
    } catch (err) {
      setErrorServidor(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  const vacuna = vacunas.find((v) => String(v.id) === datos.vacunaId);

  return (
    <Seccion as="form" className="formulario" onSubmit={enviar} noValidate>
      <h2>Registrar lote que sale en el termo</h2>

      <div className="fila-campos fila-campos--abajo">
        <Campo
          id="lote-codigo"
          etiqueta="Código de barras (opcional)"
          error={errorCodigo}
          ayuda="Escanéalo o escríbelo como (01)…(17)…(10)…. Completa el lote y el vencimiento."
        >
          <input
            {...ariaCampo('lote-codigo', errorCodigo, true)}
            value={codigo}
            autoComplete="off"
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={alTeclear}
          />
        </Campo>
        <button type="button" className="boton boton--secundario" onClick={() => void leer()} disabled={leyendo || !enLinea}>
          {leyendo ? 'Leyendo…' : 'Leer código'}
        </button>
      </div>
      {lectura && (
        <Aviso tipo={lectura.warnings.length ? 'alerta' : 'exito'}>
          {lectura.knownProduct && lectura.vaccine ? `Producto reconocido: ${lectura.vaccine.name}.` : 'Código leído.'}
          {lectura.warnings.map((w) => (
            <span key={w} className="aviso__linea">
              {w}
            </span>
          ))}
        </Aviso>
      )}

      <div className="fila-campos">
        <Campo id="lote-vacuna" etiqueta="Vacuna" error={errores.vacunaId ?? errorVacunas}>
          <select {...ariaCampo('lote-vacuna', errores.vacunaId)} value={datos.vacunaId} onChange={(e) => cambiar('vacunaId', e.target.value)}>
            <option value="">Elige la vacuna…</option>
            {vacunas.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Campo>
        <Campo id="lote-numero" etiqueta="Número de lote" error={errores.numero} ayuda="Como aparece impreso en la etiqueta.">
          <input
            {...ariaCampo('lote-numero', errores.numero, true)}
            value={datos.numero}
            maxLength={20}
            autoCapitalize="characters"
            onChange={(e) => cambiar('numero', e.target.value.toUpperCase())}
          />
        </Campo>
      </div>
      {vacuna && <CuidadosVacuna vacuna={vacuna} />}
      <div className="fila-campos">
        <Campo id="lote-vencimiento" etiqueta="Fecha de vencimiento" error={errores.vencimiento}>
          <input
            {...ariaCampo('lote-vencimiento', errores.vencimiento)}
            type="date"
            min={hoyISO()}
            value={datos.vencimiento}
            onChange={(e) => cambiar('vencimiento', e.target.value)}
          />
        </Campo>
        <Campo id="lote-frascos" etiqueta="Cantidad de frascos" error={errores.frascos}>
          <input
            {...ariaCampo('lote-frascos', errores.frascos)}
            inputMode="numeric"
            value={datos.frascos}
            maxLength={3}
            onChange={(e) => cambiar('frascos', e.target.value.replace(/\D/g, ''))}
          />
        </Campo>
        <Campo id="lote-dosis" etiqueta="Dosis (opcional)" error={errores.dosis}>
          <input
            {...ariaCampo('lote-dosis', errores.dosis)}
            inputMode="numeric"
            value={datos.dosis}
            maxLength={5}
            onChange={(e) => cambiar('dosis', e.target.value.replace(/\D/g, ''))}
          />
        </Campo>
      </div>
      <SelectorVvm nombre="lote-vvm" valor={datos.etapaVvm} onChange={(v) => cambiar('etapaVvm', v)} error={errores.etapaVvm} />
      <CampoFoto id="lote-foto" foto={foto} onChange={setFoto} />
      {!enLinea && <Aviso tipo="alerta">Necesitas internet para registrar un lote.</Aviso>}
      {errorServidor && <Aviso tipo="error">{errorServidor}</Aviso>}
      <div className="acciones">
        <button type="submit" className="boton boton--primario" disabled={enviando || !enLinea}>
          {enviando ? 'Registrando…' : 'Registrar lote'}
        </button>
        <button type="button" className="boton boton--borde" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </Seccion>
  );
}

function PanelVerificacion({
  lote,
  local,
  onGuardar,
  onCerrar,
}: {
  lote: LoteApi;
  local: DatosLocalesLote;
  onGuardar(l: DatosLocalesLote): string | null;
  onCerrar(): void;
}) {
  const [etapa, setEtapa] = useState<EtapaVvm | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ReturnType<typeof verificarLote> | null>(null);
  const caducado = vencido(lote);

  function puedeAvanzar(paso: number): boolean {
    if (paso === 2 && etapa == null) {
      setError('Indica cómo se ve el VVM del frasco.');
      return false;
    }
    return true;
  }

  function registrar() {
    if (etapa == null) return;
    const verificacion = verificarLote(lote, etapa);
    const problema = onGuardar({
      ...local,
      fotoVvm: foto ?? local.fotoVvm,
      verificaciones: [...local.verificaciones, verificacion],
    });
    if (problema) setErrorGuardado(problema);
    else setResultado(verificacion);
  }

  if (resultado || errorGuardado)
    return (
      <div className="verificacion verificacion--resultado">
        {resultado && (
          <StatusMark
            status={resultado.apto ? 'done' : 'failed'}
            label={resultado.apto ? 'APTO: el frasco se puede usar' : 'NO APTO: no uses este frasco'}
            size={30}
            fontSize={18}
            strokeWidth={2.5}
            color="#390f07"
            doneColor="#1b6e35"
            errorColor="#b42318"
            className="verificacion__marca"
          />
        )}
        {resultado && !resultado.apto && (
          <ul className="verificacion__motivos">
            {resultado.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {errorGuardado && <Aviso tipo="error">{errorGuardado}</Aviso>}
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    );

  return (
    <div className="verificacion">
      <h3>Verificación antes de vacunar</h3>
      <Stepper
        stepTitles={['Vencimiento', 'VVM', 'Confirmar']}
        canAdvance={puedeAvanzar}
        onFinalStepCompleted={registrar}
        completeButtonText="Registrar verificación"
        footerExtra={
          <button type="button" className="boton boton--borde paso-cancelar" onClick={onCerrar}>
            Cancelar
          </button>
        }
      >
        <Step>
          <p className={`paso-resultado ${caducado ? 'texto-peligro' : 'texto-ok'}`}>
            <strong>Vence el {formatoFecha(lote.expiryDate)}.</strong>{' '}
            {caducado ? 'El lote está vencido: no debe usarse.' : `${textoVencimiento(lote.expiryDate)}: vigente.`}
          </p>
          <p className="campo__ayuda">Revisa que la fecha impresa en el frasco coincida con la del lote.</p>
        </Step>
        <Step>
          <SelectorVvm
            nombre={`verif-vvm-${lote.id}`}
            valor={etapa}
            onChange={(v) => {
              setEtapa(v);
              setError(null);
            }}
            error={error}
          />
          <CampoFoto id={`verif-foto-${lote.id}`} foto={foto} onChange={setFoto} />
        </Step>
        <Step>
          <ul className="paso-resumen">
            <li className={caducado ? 'texto-peligro' : 'texto-ok'}>
              Vencimiento: {caducado ? 'vencido' : 'vigente'} ({formatoFecha(lote.expiryDate)})
            </li>
            {etapa != null && (
              <li className={infoVvm(etapa).usable ? 'texto-ok' : 'texto-peligro'}>
                <Sigla s="VVM" /> en etapa {etapa}: {infoVvm(etapa).indicacion}
              </li>
            )}
            <li>Foto del VVM: {foto ? 'adjunta' : 'sin foto'}</li>
          </ul>
        </Step>
      </Stepper>
    </div>
  );
}

function TarjetaLote({
  lote,
  local,
  estado,
  usarPrimero,
  orden,
  onGuardarLocal,
  onCerrado,
}: {
  lote: LoteApi;
  local: DatosLocalesLote;
  estado: EstadoLote;
  usarPrimero: boolean;
  orden: number;
  onGuardarLocal(l: DatosLocalesLote): string | null;
  onCerrado(lote: LoteApi, status: 'USED' | 'DISCARDED'): void;
}) {
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultima = ultimaVerificacion(local);
  const etapa = etapaActual(local);
  const caducado = vencido(lote);

  async function cerrar(status: 'USED' | 'DISCARDED') {
    setError(null);
    try {
      const motivo = status === 'USED' ? 'Se terminó' : caducado ? 'Vencido' : estado === 'no_apto' ? 'VVM en descarte' : 'Descartado';
      await cerrarLote(lote.id, status, motivo);
      onCerrado(lote, status);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <Aparecer as="li" orden={orden}>
      <div className={`lote lote--${estado}`}>
        <div className="lote__visual" aria-hidden="true">
          {etapa ? <IlustracionVvm etapa={etapa} tamano={64} /> : <span className="lote__sin-vvm">VVM</span>}
        </div>
        <div className="lote__contenido">
          <div className="lote__cabecera">
            <h2>
              {lote.vaccine.name} <span className="lote__numero">Lote {lote.lotNumber}</span>
            </h2>
            <span className={`chip chip--lote-${estado}`}>{TEXTO_ESTADO_LOTE[estado]}</span>
            {usarPrimero && <span className="chip chip--primero">Usar primero</span>}
          </div>
          <dl className="datos datos--compactos">
            <div>
              <dt>Vencimiento</dt>
              <dd>
                {formatoFecha(lote.expiryDate)} · <strong>{textoVencimiento(lote.expiryDate)}</strong>
              </dd>
            </div>
            <div>
              <dt>Frascos</dt>
              <dd>
                {lote.vials}
                {lote.doses != null && ` · ${lote.doses} dosis`}
              </dd>
            </div>
            <div>
              <dt>
                <Sigla s="VVM" />
              </dt>
              <dd className="lote__vvm">
                {etapa ? (
                  <>
                    <IlustracionVvm etapa={etapa} tamano={28} /> Etapa {etapa}: {infoVvm(etapa).indicacion}
                  </>
                ) : (
                  'Sin registrar en este equipo'
                )}
              </dd>
            </div>
            <div>
              <dt>Última verificación</dt>
              <dd>{ultima ? `${formatoFechaHora(ultima.fecha)} · ${ultima.apto ? 'Apto' : 'No apto'}` : 'Aún no verificado'}</dd>
            </div>
          </dl>
          {caducado && (
            <Aviso tipo="error">Vencido: retíralo del termo y regístralo como descartado. Ya no cuenta para el rango.</Aviso>
          )}
          <details className="lote__foto">
            <summary>Cuidados de {lote.vaccine.name}</summary>
            <CuidadosVacuna vacuna={lote.vaccine} />
          </details>
          {local.fotoVvm && (
            <details className="lote__foto">
              <summary>Ver foto del VVM</summary>
              <img src={local.fotoVvm} alt={`Foto del VVM del lote ${lote.lotNumber}`} />
            </details>
          )}
          {verificando ? (
            <PanelVerificacion lote={lote} local={local} onGuardar={onGuardarLocal} onCerrar={() => setVerificando(false)} />
          ) : (
            <div className="acciones">
              {!caducado && (
                <button type="button" className="boton boton--secundario" onClick={() => setVerificando(true)}>
                  Verificar antes de vacunar
                </button>
              )}
              {!caducado && (
                <HoldButton
                  size="md"
                  radius={12}
                  holdTime={1200}
                  backgroundColor="#ffffff"
                  fillColor="#1b6e35"
                  textColor="#390f07"
                  fillTextColor="#ffffff"
                  doneLabel="Terminado"
                  resetAfter={1500}
                  onHold={() => void cerrar('USED')}
                  className="boton-mantener"
                >
                  Mantén: se terminó
                </HoldButton>
              )}
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
                onHold={() => void cerrar('DISCARDED')}
                className="boton-mantener"
              >
                Mantén para descartar
              </HoldButton>
            </div>
          )}
          {error && <Aviso tipo="error">{error}</Aviso>}
        </div>
      </div>
    </Aparecer>
  );
}

/** Lotes activos de todos mis termos (o de todos, si es supervisor) que vencen dentro del umbral. */
function PorVencerTodos({ umbral }: { umbral: number }) {
  const { termos } = useTermo();
  const [lista, setLista] = useState<LoteApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setError(null);
    lotesPorVencer(umbral)
      .then((d) => vigente && setLista(ordenarFefo(d)))
      .catch((e) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [umbral]);

  return (
    <Seccion>
      <h2>Por vencer en {umbral} días, en todos los termos</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!lista && !error && <p className="cargando">Cargando…</p>}
      {lista && lista.length === 0 && <p className="vacio">Ningún lote vence en ese plazo.</p>}
      {lista && lista.length > 0 && (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Termo</th>
                <th scope="col">Vacuna</th>
                <th scope="col">Lote</th>
                <th scope="col">Vence</th>
                <th scope="col">Frascos</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => {
                const termo = termos.find((t) => t.contenedor === l.contenedor);
                return (
                  <tr key={l.id} className={diasHasta(l.expiryDate) <= 7 ? 'fila--fuera' : undefined}>
                    <td>{termo ? nombreTermo(termo) : l.contenedor}</td>
                    <td>{l.vaccine.name}</td>
                    <td>{l.lotNumber}</td>
                    <td>
                      {formatoFecha(l.expiryDate)} · {textoVencimiento(l.expiryDate)}
                    </td>
                    <td>{l.vials}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Seccion>
  );
}

export function Lotes() {
  const dni = useDni();
  const supervisor = useEsSupervisor();
  const { termo, termos, cargando: cargandoTermo, recargarPronto } = useTermo();
  const { locales, de, guardarLocal } = useDatosLocales(dni);
  const [lotes, setLotes] = useState<LoteApi[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desdeCache, setDesdeCache] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [umbral, setUmbral] = useState(DIAS_POR_VENCER);
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const contenedor = termo?.contenedor ?? null;
  const clave = claveUsuario(dni, `lotes:${contenedor}`);

  const cargar = useCallback(async () => {
    if (!contenedor) return;
    setCargando(true);
    setError(null);
    try {
      const datos = await lotesDelTermo(contenedor, true);
      setLotes(datos);
      setDesdeCache(null);
      guardarCache(clave, datos);
    } catch (e) {
      const cache = leerCache<LoteApi[]>(clave);
      if (esErrorDeConexion(e) && cache) {
        setLotes(cache.datos);
        setDesdeCache(cache.guardadoEn);
      } else {
        setLotes([]);
        setError(mensajeDeError(e));
      }
    } finally {
      setCargando(false);
    }
  }, [contenedor, clave]);

  useEffect(() => {
    setRegistrando(false);
    setAviso(null);
    void cargar();
  }, [cargar]);

  const hoy = hoyISO();
  const conEstado = useMemo(
    () => ordenarFefo(lotes).map((l) => ({ lote: l, estado: estadoLote(l, de(l.id), umbral, hoy) })),
    [lotes, de, umbral, hoy],
  );
  const primeros = useMemo(() => lotesUsarPrimero(lotes, locales, hoy), [lotes, locales, hoy]);
  const cuenta = (e: EstadoLote) => conEstado.filter((x) => x.estado === e).length;
  const visibles = filtro === 'todos' ? conEstado : conEstado.filter((x) => x.estado === filtro);

  if (cargandoTermo && !termo) return <p className="cargando">Cargando…</p>;

  const siglas: ClaveSigla[] = ['VVM', 'FEFO', ...siglasEnTexto(...lotes.map((l) => l.vaccine.name))];

  return (
    <>
      <Titulo>Lotes de vacunas</Titulo>
      <p className="subtitulo">
        {termo ? `Lotes de ${nombreTermo(termo)}, ordenados por ` : 'Ordenados por '}
        <Sigla s="FEFO" />: arriba, lo que vence primero. El rango de alarma del termo se calcula con sus lotes. Antes de
        vacunar, verifica el vencimiento y el <Sigla s="VVM" />.
      </p>

      {!termo ? (
        <Aviso tipo="info">
          Para registrar lotes, primero <Link to="/termos">vincula o registra un termo</Link>.
        </Aviso>
      ) : (
        <>
          <section className="cifras" aria-label="Resumen de lotes">
            <div className="cifra">
              <span className="cifra__valor"><Numero valor={lotes.length} /></span>
              <span className="cifra__nombre">Lotes en el termo</span>
            </div>
            <div className="cifra cifra--alerta">
              <span className="cifra__valor"><Numero valor={cuenta('por_vencer')} /></span>
              <span className="cifra__nombre">Vencen en {umbral} días o menos</span>
            </div>
            <div className="cifra cifra--peligro">
              <span className="cifra__valor"><Numero valor={cuenta('vencido')} /></span>
              <span className="cifra__nombre">Vencidos</span>
            </div>
            <div className="cifra cifra--peligro">
              <span className="cifra__valor"><Numero valor={cuenta('no_apto')} /></span>
              <span className="cifra__nombre">No aptos por VVM</span>
            </div>
          </section>

          {aviso && <Aviso tipo="exito">{aviso}</Aviso>}
          {desdeCache && <Aviso tipo="alerta">Sin conexión: lista guardada el {formatoFechaHora(desdeCache)}.</Aviso>}
          {error && <Aviso tipo="error">{error}</Aviso>}

          {registrando ? (
            <FormularioLote
              key={termo.contenedor}
              contenedor={termo.contenedor}
              onCancelar={() => setRegistrando(false)}
              onRegistrado={(lote, local) => {
                const guardado = guardarLocal(lote.id, local);
                const todos = [...lotes, lote];
                const ids = lotesUsarPrimero(todos, { ...locales, [lote.id]: local });
                const primero = todos.find((l) => l.vaccine.id === lote.vaccine.id && ids.has(l.id));
                setLotes(todos);
                setAviso(
                  (primero && primero.id !== lote.id
                    ? `Lote ${lote.lotNumber} registrado. Según FEFO, de ${lote.vaccine.name} usa primero el lote ${primero.lotNumber}.`
                    : `Lote ${lote.lotNumber} registrado.`) + (guardado ? '' : ` ${SIN_ESPACIO}`),
                );
                setRegistrando(false);
                recargarPronto();
              }}
            />
          ) : (
            <button
              type="button"
              className="boton boton--primario"
              onClick={() => {
                setAviso(null);
                setRegistrando(true);
              }}
            >
              Registrar lote
            </button>
          )}

          <div className="barra-filtros">
            <div className="segmentos" role="radiogroup" aria-label="Filtrar lotes">
              {(Object.keys(TEXTO_FILTRO) as Filtro[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filtro === f}
                  className={`segmento${filtro === f ? ' segmento--activo' : ''}`}
                  onClick={() => setFiltro(f)}
                >
                  {TEXTO_FILTRO[f]} ({f === 'todos' ? lotes.length : cuenta(f)})
                </button>
              ))}
            </div>
            <Campo id="umbral" etiqueta="Considerar «por vencer» desde">
              <select id="umbral" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))}>
                {UMBRALES.map((u) => (
                  <option key={u} value={u}>
                    {u} días antes
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          {cargando && lotes.length === 0 ? (
            <p className="cargando">Cargando lotes…</p>
          ) : visibles.length === 0 ? (
            <p className="vacio">{lotes.length === 0 ? 'Aún no hay lotes en este termo.' : 'No hay lotes con este filtro.'}</p>
          ) : (
            <ul className="lista-lotes">
              {visibles.map(({ lote, estado }, i) => (
                <TarjetaLote
                  key={lote.id}
                  lote={lote}
                  local={de(lote.id)}
                  estado={estado}
                  usarPrimero={primeros.has(lote.id)}
                  orden={i}
                  onGuardarLocal={(l) => (guardarLocal(lote.id, l) ? null : SIN_ESPACIO)}
                  onCerrado={(l, status) => {
                    setLotes((ls) => ls.filter((x) => x.id !== l.id));
                    setAviso(
                      status === 'USED'
                        ? `Lote ${l.lotNumber} de ${l.vaccine.name} marcado como terminado.`
                        : `Lote ${l.lotNumber} de ${l.vaccine.name} descartado.`,
                    );
                    recargarPronto();
                  }}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {(supervisor || termos.length > 1) && <PorVencerTodos umbral={umbral} />}

      <Leyenda siglas={[...new Set(siglas)]} />
    </>
  );
}
