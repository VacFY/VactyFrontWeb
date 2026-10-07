import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { mensajeDeError } from '../api/http';
import { historialAsignaciones, regenerarClave, registrarTermo } from '../api/servicios';
import type { Asignacion, ClaveTermo, Termo } from '../api/tipos';
import { Aparecer, Seccion, Titulo } from '../components/Animados';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import HoldButton from '../components/reactbits/HoldButton/HoldButton';
import { useEsSupervisor } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { formatoFecha, formatoFechaHora, formatoTemp, haceCuanto } from '../lib/format';
import { useAhora, useEnLinea } from '../lib/hooks';
import {
  nombreTermo,
  separarQr,
  TEXTO_ESTADO_TERMO,
  TEXTO_MOTIVO_CIERRE,
  textoRango,
  validarClave,
  validarCodigoTermo,
  validarNombreTermo,
} from '../lib/termo';

type Mensaje = { tipo: 'error' | 'exito' | 'info'; texto: string } | null;

const CHIP_ESTADO: Record<Termo['status'], string> = {
  OK: 'chip--ok',
  ALERTA: 'chip--peligro',
  SIN_DATOS: 'chip--alerta',
};

const propsMantener = {
  size: 'md',
  radius: 12,
  holdTime: 1200,
  backgroundColor: '#ffffff',
  textColor: '#390f07',
  fillTextColor: '#ffffff',
  resetAfter: 1500,
  className: 'boton-mantener',
} as const;

/** Clave recién generada: solo se muestra esta vez, para imprimirla en la etiqueta del termo. */
function PanelClave({ clave, onCerrar }: { clave: ClaveTermo; onCerrar(): void }) {
  const [copiada, setCopiada] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(clave.clave);
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  }

  return (
    <Seccion className="clave-termo" aria-live="polite">
      <p className="clave-termo__aviso">Anota o imprime esta clave ahora: no se vuelve a mostrar.</p>
      <div className="clave-termo__etiqueta">
        <p className="clave-termo__nombre">{clave.nombre}</p>
        <p className="clave-termo__dato">
          Código <strong>{clave.codigo}</strong>
        </p>
        <p className="clave-termo__dato">
          Clave <strong className="clave-termo__clave">{clave.clave}</strong>
        </p>
      </div>
      <p className="campo__ayuda">
        La enfermera vincula el termo en «Mis termos» con este código y esta clave. Si se pierde, genera una nueva: la
        anterior deja de servir.
      </p>
      <div className="acciones">
        <button type="button" className="boton boton--primario" onClick={() => window.print()}>
          Imprimir etiqueta
        </button>
        <button type="button" className="boton boton--secundario" onClick={() => void copiar()}>
          {copiada ? 'Clave copiada' : 'Copiar clave'}
        </button>
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Ya la anoté
        </button>
      </div>
    </Seccion>
  );
}

function FormularioVincular() {
  const { vincular } = useTermo();
  const enLinea = useEnLinea();
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState<{ codigo?: string | null; clave?: string | null }>({});
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [enviando, setEnviando] = useState(false);

  /** Si se pega el texto del QR del termo ("vacty:001:K7P29Q"), se separa en código y clave. */
  function cambiar(campo: 'codigo' | 'clave', valor: string) {
    const qr = separarQr(valor);
    if (qr) {
      setCodigo(qr.codigo);
      setClave(qr.clave);
    } else if (campo === 'codigo') setCodigo(valor);
    else setClave(valor.toUpperCase());
    setErrores({});
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = { codigo: validarCodigoTermo(codigo), clave: validarClave(clave) };
    setErrores(nuevos);
    setMensaje(null);
    if (nuevos.codigo || nuevos.clave) return;
    setEnviando(true);
    try {
      const r = await vincular(codigo.trim(), clave.trim());
      const nombre = r.nombre || `El termo ${r.contenedor}`;
      setMensaje({
        tipo: 'exito',
        texto: r.nuevaAsignacion ? `Listo: ${nombre} quedó vinculado a tu cuenta.` : `${nombre} ya estaba vinculado a tu cuenta.`,
      });
      setCodigo('');
      setClave('');
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Seccion as="form" className="formulario" onSubmit={enviar} noValidate>
      <h2>Vincular un termo</h2>
      <p className="campo__ayuda">
        Usa el código y la clave impresos en la etiqueta del termo. Si otra enfermera lo tenía, pasa a tu cuenta (cambio de
        turno).
      </p>
      <div className="fila-campos">
        <Campo id="vincular-codigo" etiqueta="Código del termo" error={errores.codigo} ayuda="Por ejemplo: 001.">
          <input
            {...ariaCampo('vincular-codigo', errores.codigo, true)}
            value={codigo}
            maxLength={64}
            autoCapitalize="off"
            autoComplete="off"
            onChange={(e) => cambiar('codigo', e.target.value)}
          />
        </Campo>
        <Campo id="vincular-clave" etiqueta="Clave" error={errores.clave} ayuda="Formato XXX-XXX.">
          <input
            {...ariaCampo('vincular-clave', errores.clave, true)}
            value={clave}
            maxLength={64}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => cambiar('clave', e.target.value)}
          />
        </Campo>
      </div>
      {!enLinea && <Aviso tipo="alerta">Necesitas internet para vincular un termo.</Aviso>}
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      <div className="acciones">
        <button type="submit" className="boton boton--primario" disabled={enviando || !enLinea}>
          {enviando ? 'Vinculando…' : 'Vincular termo'}
        </button>
      </div>
    </Seccion>
  );
}

function FormularioRegistrar({ codigoInicial, onClave }: { codigoInicial: string; onClave(c: ClaveTermo): void }) {
  const { recargar } = useTermo();
  const enLinea = useEnLinea();
  const [codigo, setCodigo] = useState(codigoInicial);
  const [nombre, setNombre] = useState('');
  const [errores, setErrores] = useState<{ codigo?: string | null; nombre?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setCodigo(codigoInicial), [codigoInicial]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = { codigo: validarCodigoTermo(codigo), nombre: validarNombreTermo(nombre) };
    setErrores(nuevos);
    setError(null);
    if (nuevos.codigo || nuevos.nombre) return;
    setEnviando(true);
    try {
      const clave = await registrarTermo(codigo.trim(), nombre.trim());
      onClave(clave);
      setCodigo('');
      setNombre('');
      void recargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Seccion as="form" className="formulario" onSubmit={enviar} noValidate>
      <h2>Registrar un termo</h2>
      <div className="fila-campos">
        <Campo
          id="registrar-codigo"
          etiqueta="Código del sensor"
          error={errores.codigo}
          ayuda="El que envía el ESP32 en cada lectura (por ejemplo, 001)."
        >
          <input
            {...ariaCampo('registrar-codigo', errores.codigo, true)}
            value={codigo}
            maxLength={32}
            autoCapitalize="off"
            onChange={(e) => setCodigo(e.target.value)}
          />
        </Campo>
        <Campo id="registrar-nombre" etiqueta="Nombre del termo" error={errores.nombre} ayuda="Por ejemplo: Termo Posta Huambos.">
          <input
            {...ariaCampo('registrar-nombre', errores.nombre, true)}
            value={nombre}
            maxLength={60}
            onChange={(e) => setNombre(e.target.value)}
          />
        </Campo>
      </div>
      {!enLinea && <Aviso tipo="alerta">Necesitas internet para registrar un termo.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="acciones">
        <button type="submit" className="boton boton--primario" disabled={enviando || !enLinea}>
          {enviando ? 'Registrando…' : 'Registrar y generar clave'}
        </button>
      </div>
    </Seccion>
  );
}

function HistorialAsignaciones({ codigo }: { codigo: string }) {
  const [lista, setLista] = useState<Asignacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    historialAsignaciones(codigo)
      .then((d) => vigente && setLista(d))
      .catch((e) => vigente && setError(mensajeDeError(e)));
    return () => {
      vigente = false;
    };
  }, [codigo]);

  if (error) return <Aviso tipo="error">{error}</Aviso>;
  if (!lista) return <p className="cargando">Cargando historial…</p>;
  if (!lista.length) return <p className="vacio">Nadie lo ha tenido todavía.</p>;
  return (
    <ol className="asignaciones">
      {lista.map((a) => (
        <li key={a.id}>
          <strong>{a.persona?.nombre ?? 'Sin nombre'}</strong>
          {a.persona && <span> · DNI {a.persona.dni}</span>}
          <span className="asignaciones__fechas">
            {formatoFechaHora(a.desde)} → {a.hasta ? formatoFechaHora(a.hasta) : 'ahora'}
          </span>
          {a.motivoCierre && <span className="chip">{TEXTO_MOTIVO_CIERRE[a.motivoCierre] ?? a.motivoCierre}</span>}
        </li>
      ))}
    </ol>
  );
}

function FilaTermo({
  termo,
  orden,
  supervisor,
  ahora,
  onRegistrar,
  onClave,
}: {
  termo: Termo;
  orden: number;
  supervisor: boolean;
  ahora: number;
  onRegistrar(codigo: string): void;
  onClave(c: ClaveTermo): void;
}) {
  const { termo: activo, elegir, entregar } = useTermo();
  const navigate = useNavigate();
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const registrado = termo.registrado !== false;

  async function quitar() {
    setMensaje(null);
    try {
      await entregar(termo.contenedor);
      if (supervisor) setMensaje({ tipo: 'exito', texto: `${nombreTermo(termo)} quedó sin asignar.` });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(e) });
    }
  }

  async function nuevaClave() {
    setMensaje(null);
    try {
      onClave(await regenerarClave(termo.contenedor));
    } catch (e) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(e) });
    }
  }

  return (
    <Aparecer as="li" orden={orden}>
      <div className={`termo-fila termo-fila--${termo.status.toLowerCase()}`}>
        <div className="lote__cabecera">
          <h2>
            {nombreTermo(termo)} <span className="lote__numero">Código {termo.contenedor}</span>
          </h2>
          <span className={`chip ${CHIP_ESTADO[termo.status]}`}>{TEXTO_ESTADO_TERMO[termo.status]}</span>
          {!registrado && <span className="chip chip--alerta">Sin registrar</span>}
          {termo.activo === false && <span className="chip">Inactivo</span>}
          {activo?.contenedor === termo.contenedor && <span className="chip chip--primero">En pantalla</span>}
        </div>
        <dl className="datos datos--compactos">
          <div>
            <dt>Temperatura</dt>
            <dd>
              {formatoTemp(termo.temperatura)}
              {termo.lastReadingAt && ` · ${haceCuanto(ahora - new Date(termo.lastReadingAt).getTime())}`}
            </dd>
          </div>
          <div>
            <dt>Rango</dt>
            <dd>{textoRango(termo.range)}</dd>
          </div>
          <div>
            <dt>Lotes</dt>
            <dd>
              {termo.activeLots} activos{termo.expiredLots ? ` · ${termo.expiredLots} vencidos` : ''}
            </dd>
          </div>
          <div>
            <dt>Alertas abiertas</dt>
            <dd className={termo.openAlerts ? 'texto-peligro' : undefined}>
              {termo.openAlerts}
              {termo.highestSeverity === 'CRITICAL' ? ' (crítica)' : ''}
            </dd>
          </div>
          {termo.nextExpiry && (
            <div>
              <dt>Vence primero</dt>
              <dd>
                {termo.nextExpiry.vaccine} {termo.nextExpiry.lotNumber} · {formatoFecha(termo.nextExpiry.expiryDate)}
              </dd>
            </div>
          )}
          {supervisor ? (
            <div>
              <dt>Lo tiene</dt>
              <dd>
                {termo.asignadoA
                  ? `${termo.asignadoA.nombre ?? 'Sin nombre'} (DNI ${termo.asignadoA.dni}), desde ${formatoFechaHora(termo.asignadoA.desde)}`
                  : 'Nadie'}
              </dd>
            </div>
          ) : (
            termo.asignadoDesde && (
              <div>
                <dt>Lo tienes desde</dt>
                <dd>{formatoFechaHora(termo.asignadoDesde)}</dd>
              </div>
            )
          )}
        </dl>

        <div className="acciones">
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => {
              elegir(termo.contenedor);
              navigate('/');
            }}
          >
            Ver en vivo
          </button>
          {!supervisor && (
            <HoldButton {...propsMantener} fillColor="#b42318" doneLabel="Entregado" onHold={() => void quitar()}>
              Mantén para entregar el termo
            </HoldButton>
          )}
          {supervisor && !registrado && (
            <button type="button" className="boton boton--primario" onClick={() => onRegistrar(termo.contenedor)}>
              Registrar este termo
            </button>
          )}
          {supervisor && termo.asignadoA && (
            <HoldButton {...propsMantener} fillColor="#b42318" doneLabel="Desvinculado" onHold={() => void quitar()}>
              Mantén para desvincular
            </HoldButton>
          )}
          {supervisor && registrado && (
            <HoldButton {...propsMantener} fillColor="#390f07" doneLabel="Clave nueva" onHold={() => void nuevaClave()}>
              Mantén para generar otra clave
            </HoldButton>
          )}
          {supervisor && registrado && (
            <button type="button" className="boton boton--borde" onClick={() => setVerHistorial((v) => !v)}>
              {verHistorial ? 'Ocultar historial' : 'Quién lo tuvo'}
            </button>
          )}
        </div>
        {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
        {verHistorial && <HistorialAsignaciones codigo={termo.contenedor} />}
      </div>
    </Aparecer>
  );
}

export function Termos() {
  const supervisor = useEsSupervisor();
  const { termos, cargando, error, desdeCache, recargar } = useTermo();
  const ahora = useAhora(30_000);
  const [clave, setClave] = useState<ClaveTermo | null>(null);
  const [codigoARegistrar, setCodigoARegistrar] = useState('');

  return (
    <>
      <Titulo>{supervisor ? 'Termos' : 'Mis termos'}</Titulo>
      <p className="subtitulo">
        {supervisor
          ? 'Todos los termos de la microred: quién tiene cada uno, su temperatura y sus lotes. Registra los nuevos y entrega su clave a la enfermera.'
          : 'Los termos que llevas. Cuando termines tu turno, entrégalo para que otra enfermera lo vincule.'}
      </p>

      {clave && <PanelClave clave={clave} onCerrar={() => setClave(null)} />}
      {supervisor ? (
        <FormularioRegistrar
          codigoInicial={codigoARegistrar}
          onClave={(c) => {
            setClave(c);
            setCodigoARegistrar('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      ) : (
        <FormularioVincular />
      )}

      <Seccion>
        <div className="seccion__cabecera">
          <h2>{supervisor ? `${termos.length} termos` : termos.length === 1 ? 'Tu termo' : `Tus ${termos.length} termos`}</h2>
          <button type="button" className="boton boton--borde boton--chico" onClick={() => void recargar()} disabled={cargando}>
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        {desdeCache && <Aviso tipo="alerta">Sin conexión: lista guardada el {formatoFechaHora(desdeCache)}.</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        {!cargando && !error && termos.length === 0 && (
          <p className="vacio">
            {supervisor
              ? 'Aún no hay termos. Registra el primero con el código que envía su sensor.'
              : 'Aún no tienes termos. Pide a tu supervisor el código y la clave del termo que vas a llevar.'}
          </p>
        )}
        <ul className="lista-lotes">
          {termos.map((t, i) => (
            <FilaTermo
              key={t.contenedor}
              termo={t}
              orden={i}
              supervisor={supervisor}
              ahora={ahora}
              onRegistrar={(codigo) => {
                setCodigoARegistrar(codigo);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onClave={(c) => {
                setClave(c);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}
        </ul>
      </Seccion>
    </>
  );
}
