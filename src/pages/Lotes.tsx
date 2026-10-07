import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Aparecer, Numero, Seccion, Titulo } from '../components/Animados';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import HoldButton from '../components/reactbits/HoldButton/HoldButton';
import StatusMark from '../components/reactbits/StatusMark/StatusMark';
import Stepper, { Step } from '../components/reactbits/Stepper/Stepper';
import { IlustracionVvm } from '../components/IlustracionVvm';
import { SelectorVvm } from '../components/SelectorVvm';
import { Leyenda, Sigla } from '../components/Siglas';
import { DIAS_POR_VENCER } from '../config';
import { useDni } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { diasHasta, formatoFecha, formatoFechaHora, hoyISO } from '../lib/format';
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
  verificarLote,
  type DatosLote,
  type ErroresLote,
  type EstadoLote,
  type EtapaVvm,
  type Lote,
} from '../lib/lotes';
import { siglasEnTexto, type Sigla as ClaveSigla } from '../lib/siglas';
import { useLotes } from '../lib/useLotes';

type Filtro = 'todos' | 'por_vencer' | 'vencido' | 'no_apto';
const TEXTO_FILTRO: Record<Filtro, string> = {
  todos: 'Todos',
  por_vencer: 'Por vencer',
  vencido: 'Vencidos',
  no_apto: 'No aptos',
};
const UMBRALES = [7, 15, 30, 60];

function textoVencimiento(vencimiento: string): string {
  const dias = diasHasta(vencimiento);
  if (dias < 0) return dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
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
    <Campo id={id} etiqueta={<>Foto del <Sigla s="VVM" /> (opcional)</>} error={error} ayuda="Sirve como evidencia del estado del frasco.">
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
  vacunas,
  lotes,
  onGuardar,
  onCancelar,
}: {
  vacunas: string[];
  lotes: Lote[];
  onGuardar(lote: Lote): string | null;
  onCancelar(): void;
}) {
  const [datos, setDatos] = useState<DatosLote>({
    vacuna: vacunas.length === 1 ? vacunas[0] : '',
    numero: '',
    vencimiento: '',
    frascos: '',
    etapaVvm: null,
  });
  const [foto, setFoto] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresLote>({});
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  const cambiar = <K extends keyof DatosLote>(campo: K, valor: DatosLote[K]) => {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  };

  function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = validarLote(datos, { vacunasTermo: vacunas, lotes });
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    const lote: Lote = {
      id: crypto.randomUUID(),
      vacuna: datos.vacuna,
      numero: normalizarNumeroLote(datos.numero),
      vencimiento: datos.vencimiento,
      frascos: Number(datos.frascos),
      etapaVvm: datos.etapaVvm as EtapaVvm,
      fotoVvm: foto,
      registradoEn: new Date().toISOString(),
      verificaciones: [],
    };
    setErrorGuardado(onGuardar(lote));
  }

  return (
    <Seccion as="form" className="formulario" onSubmit={enviar} noValidate>
      <h2>Registrar lote que sale en el termo</h2>
      <div className="fila-campos">
        <Campo id="lote-vacuna" etiqueta="Vacuna" error={errores.vacuna}>
          <select {...ariaCampo('lote-vacuna', errores.vacuna)} value={datos.vacuna} onChange={(e) => cambiar('vacuna', e.target.value)}>
            <option value="">Elige la vacuna…</option>
            {vacunas.map((v) => (
              <option key={v} value={v}>
                {v}
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
      </div>
      <SelectorVvm nombre="lote-vvm" valor={datos.etapaVvm} onChange={(v) => cambiar('etapaVvm', v)} error={errores.etapaVvm} />
      <CampoFoto id="lote-foto" foto={foto} onChange={setFoto} />
      {errorGuardado && <Aviso tipo="error">{errorGuardado}</Aviso>}
      <div className="acciones">
        <button type="submit" className="boton boton--primario">
          Registrar lote
        </button>
        <button type="button" className="boton boton--borde" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </Seccion>
  );
}

function PanelVerificacion({ lote, onGuardar, onCerrar }: { lote: Lote; onGuardar(l: Lote): string | null; onCerrar(): void }) {
  const [etapa, setEtapa] = useState<EtapaVvm | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ReturnType<typeof verificarLote> | null>(null);
  const vencido = diasHasta(lote.vencimiento) < 0;

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
      ...lote,
      fotoVvm: foto ?? lote.fotoVvm,
      verificaciones: [...lote.verificaciones, verificacion],
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
          <p className={`paso-resultado ${vencido ? 'texto-peligro' : 'texto-ok'}`}>
            <strong>Vence el {formatoFecha(lote.vencimiento)}.</strong>{' '}
            {vencido ? 'El lote está vencido: no debe usarse.' : `${textoVencimiento(lote.vencimiento)}: vigente.`}
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
            <li className={vencido ? 'texto-peligro' : 'texto-ok'}>
              Vencimiento: {vencido ? 'vencido' : 'vigente'} ({formatoFecha(lote.vencimiento)})
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
  estado,
  usarPrimero,
  orden,
  onGuardar,
  onRetirar,
}: {
  lote: Lote;
  estado: EstadoLote;
  usarPrimero: boolean;
  orden: number;
  onGuardar(l: Lote): string | null;
  onRetirar(): void;
}) {
  const [verificando, setVerificando] = useState(false);
  const [pista, setPista] = useState(false);
  const ultima = ultimaVerificacion(lote);
  const etapa = etapaActual(lote);

  return (
    <Aparecer as="li" orden={orden}>
      <div className={`lote lote--${estado}`}>
        <div className="lote__visual" aria-hidden="true">
          <IlustracionVvm etapa={etapa} tamano={64} />
        </div>
        <div className="lote__contenido">
        <div className="lote__cabecera">
          <h2>
            {lote.vacuna} <span className="lote__numero">Lote {lote.numero}</span>
          </h2>
          <span className={`chip chip--lote-${estado}`}>{TEXTO_ESTADO_LOTE[estado]}</span>
          {usarPrimero && <span className="chip chip--primero">Usar primero</span>}
        </div>
        <dl className="datos datos--compactos">
          <div>
            <dt>Vencimiento</dt>
            <dd>
              {formatoFecha(lote.vencimiento)} · <strong>{textoVencimiento(lote.vencimiento)}</strong>
            </dd>
          </div>
          <div>
            <dt>Frascos</dt>
            <dd>{lote.frascos}</dd>
          </div>
          <div>
            <dt>
              <Sigla s="VVM" />
            </dt>
            <dd className="lote__vvm">
              <IlustracionVvm etapa={etapa} tamano={28} /> Etapa {etapa}: {infoVvm(etapa).indicacion}
            </dd>
          </div>
          <div>
            <dt>Última verificación</dt>
            <dd>
              {ultima ? `${formatoFechaHora(ultima.fecha)} · ${ultima.apto ? 'Apto' : 'No apto'}` : 'Aún no verificado'}
            </dd>
          </div>
        </dl>
        {lote.fotoVvm && (
          <details className="lote__foto">
            <summary>Ver foto del VVM</summary>
            <img src={lote.fotoVvm} alt={`Foto del VVM del lote ${lote.numero}`} />
          </details>
        )}
        {verificando ? (
          <PanelVerificacion lote={lote} onGuardar={onGuardar} onCerrar={() => setVerificando(false)} />
        ) : (
          <div className="acciones">
            <button type="button" className="boton boton--secundario" onClick={() => setVerificando(true)}>
              Verificar antes de vacunar
            </button>
            <HoldButton
              size="md"
              radius={12}
              holdTime={1200}
              backgroundColor="#ffffff"
              fillColor="#b42318"
              textColor="#390f07"
              fillTextColor="#ffffff"
              doneLabel="Retirado"
              resetAfter={0}
              onHold={onRetirar}
              onTap={() => setPista(true)}
              className="boton-mantener"
            >
              Mantén para retirar del termo
            </HoldButton>
          </div>
        )}
        {pista && !verificando && (
          <p className="campo__ayuda" role="status">
            Mantén presionado el botón un segundo para retirar el lote. Se borrará de la lista.
          </p>
        )}
        </div>
      </div>
    </Aparecer>
  );
}

export function Lotes() {
  const dni = useDni();
  const { termo, cargando } = useTermo();
  const { lotes, actualizar } = useLotes(dni);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [umbral, setUmbral] = useState(DIAS_POR_VENCER);
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const hoy = hoyISO();
  const conEstado = useMemo(
    () => ordenarFefo(lotes).map((l) => ({ lote: l, estado: estadoLote(l, umbral, hoy) })),
    [lotes, umbral, hoy],
  );
  const primeros = useMemo(() => lotesUsarPrimero(lotes, hoy), [lotes, hoy]);
  const cuenta = (e: EstadoLote) => conEstado.filter((x) => x.estado === e).length;
  const visibles = filtro === 'todos' ? conEstado : conEstado.filter((x) => x.estado === filtro);

  if (cargando && !termo) return <p className="cargando">Cargando…</p>;

  const vacunasTermo = termo?.vacunas.map((v) => v.nombre) ?? [];
  const sinMemoria = 'No hay espacio en este dispositivo. Retira lotes antiguos o quita la foto e inténtalo de nuevo.';
  const guardarLote = (l: Lote) => (actualizar((ls) => ls.map((x) => (x.id === l.id ? l : x))) ? null : sinMemoria);

  const siglas: ClaveSigla[] = ['VVM', 'FEFO', ...siglasEnTexto(...vacunasTermo, ...lotes.map((l) => l.vacuna))];

  return (
    <>
      <Titulo>Lotes de vacunas</Titulo>
      <p className="subtitulo">
        Ordenados por <Sigla s="FEFO" />: arriba, lo que vence primero. Antes de vacunar, verifica el vencimiento y el{' '}
        <Sigla s="VVM" />.
      </p>
      <Aviso tipo="info">Los lotes se guardan en este dispositivo y funcionan sin internet.</Aviso>

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

      {!termo || vacunasTermo.length === 0 ? (
        <Aviso tipo="info">
          Para registrar lotes, primero <Link to="/termo">registra tu termo y sus vacunas</Link>.
        </Aviso>
      ) : registrando ? (
        <FormularioLote
          vacunas={vacunasTermo}
          lotes={lotes}
          onCancelar={() => setRegistrando(false)}
          onGuardar={(lote) => {
            if (!actualizar((ls) => [...ls, lote])) return sinMemoria;
            const todos = [...lotes, lote];
            const ids = lotesUsarPrimero(todos);
            const primero = todos.find((l) => l.vacuna === lote.vacuna && ids.has(l.id));
            setAviso(
              primero && primero.id !== lote.id
                ? `Lote ${lote.numero} registrado. Según FEFO, de ${lote.vacuna} usa primero el lote ${primero.numero}.`
                : `Lote ${lote.numero} registrado.`,
            );
            setRegistrando(false);
            return null;
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

      {visibles.length === 0 ? (
        <p className="vacio">{lotes.length === 0 ? 'Aún no registras lotes.' : 'No hay lotes con este filtro.'}</p>
      ) : (
        <ul className="lista-lotes">
          {visibles.map(({ lote, estado }, i) => (
            <TarjetaLote
              key={lote.id}
              lote={lote}
              estado={estado}
              usarPrimero={primeros.has(lote.id)}
              orden={i}
              onGuardar={guardarLote}
              onRetirar={() => {
                actualizar((ls) => ls.filter((x) => x.id !== lote.id));
                setAviso(`Lote ${lote.numero} de ${lote.vacuna} retirado del termo.`);
              }}
            />
          ))}
        </ul>
      )}

      <Leyenda siglas={[...new Set(siglas)]} />
    </>
  );
}
