import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api/http';
import { Aparecer, Numero, Seccion, Titulo } from '../components/Animados';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import { Leyenda, Sigla } from '../components/Siglas';
import { useTermo } from '../context/TermoContext';
import { formatoRango } from '../lib/format';
import { useEnLinea } from '../lib/hooks';
import type { Termo, VacunaTermo } from '../lib/termo';
import { validarContenedor, validarNombreTermo, validarNuevaVacuna, validarRango } from '../lib/validacion';
import { buscarEnCatalogo, CATALOGO_VACUNAS } from '../lib/vacunas';

const OTRA = '__otra__';

function ResumenTermo({ termo, onEditar }: { termo: Termo; onEditar(): void }) {
  return (
    <Seccion as="section">
      <div className="seccion__cabecera">
        <h2 className="termo__nombre">{termo.nombre}</h2>
        <button type="button" className="boton boton--borde" onClick={onEditar}>
          Editar termo
        </button>
      </div>
      <div className="cifras">
        <div className="cifra">
          <span className="cifra__valor">{termo.contenedor}</span>
          <span className="cifra__nombre">código del sensor</span>
        </div>
        <div className="cifra cifra--frio">
          <span className="cifra__valor">
            <Numero valor={termo.min} decimales={1} sufijo=" °C" />
          </span>
          <span className="cifra__nombre">mínima segura</span>
        </div>
        <div className="cifra cifra--peligro">
          <span className="cifra__valor">
            <Numero valor={termo.max} decimales={1} sufijo=" °C" />
          </span>
          <span className="cifra__nombre">máxima segura</span>
        </div>
      </div>
      <p className={`termo__congelacion${termo.sensibleCongelacion ? ' termo__congelacion--critica' : ''}`}>
        {termo.sensibleCongelacion
          ? 'Lleva vacunas que se dañan si se congelan: bajar del mínimo genera una alerta crítica.'
          : 'Ninguna vacuna del termo se daña por congelación: bajar del mínimo genera una advertencia.'}
      </p>
      <h3>Vacunas que lleva</h3>
      <ul className="lista-vacunas">
        {termo.vacunas.map((v, i) => (
          <Aparecer as="li" key={v.nombre} orden={i}>
            <strong>{v.nombre}</strong>
            <span>{formatoRango(v.min, v.max)}</span>
            <span className={v.sensibleCongelacion ? 'etiqueta etiqueta--frio' : 'etiqueta'}>
              {v.sensibleCongelacion ? 'Se daña si se congela' : 'No se daña por congelación'}
            </span>
          </Aparecer>
        ))}
      </ul>
    </Seccion>
  );
}

function FormularioTermo({ termo, onCancelar, onGuardado }: { termo: Termo | null; onCancelar?(): void; onGuardado(): void }) {
  const { guardarTermo } = useTermo();
  const enLinea = useEnLinea();
  const [nombre, setNombre] = useState(termo?.nombre ?? '');
  const [contenedor, setContenedor] = useState(termo?.contenedor ?? '');
  const [vacunas, setVacunas] = useState<VacunaTermo[]>(termo?.vacunas ?? []);
  const [errores, setErrores] = useState<{ nombre?: string | null; contenedor?: string | null; vacunas?: string | null }>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Sub-formulario para agregar una vacuna
  const [tipo, setTipo] = useState('');
  const [otroNombre, setOtroNombre] = useState('');
  const [otraSensible, setOtraSensible] = useState(true);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [erroresVacuna, setErroresVacuna] = useState<{ tipo?: string | null; min?: string; max?: string; general?: string | null }>({});

  function elegirTipo(valor: string) {
    setTipo(valor);
    setErroresVacuna({});
    const cat = buscarEnCatalogo(valor);
    if (cat) {
      setMin(String(cat.min));
      setMax(String(cat.max));
    } else if (valor === OTRA && vacunas.length) {
      setMin(String(vacunas[0].min));
      setMax(String(vacunas[0].max));
    }
  }

  function agregarVacuna() {
    const nombreVacuna = tipo === OTRA ? otroNombre.trim() : tipo;
    const rango = validarRango(min, max);
    const errorTipo = !tipo ? 'Elige el tipo de vacuna.' : tipo === OTRA && !nombreVacuna ? 'Escribe el nombre de la vacuna.' : null;
    if (errorTipo || rango.errorMin || rango.errorMax) {
      setErroresVacuna({ tipo: errorTipo, min: rango.errorMin, max: rango.errorMax });
      return;
    }
    const nueva: VacunaTermo = {
      nombre: nombreVacuna,
      min: rango.min!,
      max: rango.max!,
      sensibleCongelacion: buscarEnCatalogo(nombreVacuna)?.sensibleCongelacion ?? otraSensible,
    };
    const error = validarNuevaVacuna(nueva, vacunas);
    if (error) {
      setErroresVacuna({ general: error });
      return;
    }
    setVacunas([...vacunas, nueva]);
    setErrores((e) => ({ ...e, vacunas: null }));
    setTipo('');
    setOtroNombre('');
    setOtraSensible(true);
    setMin('');
    setMax('');
    setErroresVacuna({});
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = {
      nombre: validarNombreTermo(nombre),
      contenedor: validarContenedor(contenedor),
      vacunas: vacunas.length ? null : 'Agrega al menos una vacuna con su rango de temperatura.',
    };
    setErrores(nuevos);
    setErrorServidor(null);
    if (nuevos.nombre || nuevos.contenedor || nuevos.vacunas) return;
    setGuardando(true);
    try {
      await guardarTermo({ nombre: nombre.trim(), contenedor: contenedor.trim(), vacunas });
      onGuardado();
    } catch (err) {
      setErrorServidor(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const disponibles = CATALOGO_VACUNAS.filter((c) => !vacunas.some((v) => v.nombre === c.nombre));

  return (
    <Seccion as="form" className="formulario" onSubmit={enviar} noValidate>
      <h2>{termo ? 'Editar termo' : 'Registrar termo'}</h2>

      <Campo id="nombre-termo" etiqueta="Nombre del termo" error={errores.nombre} ayuda="Por ejemplo: Termo KST puesto Yanacachi.">
        <input {...ariaCampo('nombre-termo', errores.nombre, true)} value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />
      </Campo>

      <Campo
        id="contenedor"
        etiqueta="Código del sensor"
        error={errores.contenedor}
        ayuda="Código que el sensor del termo envía con cada lectura (por ejemplo, 001)."
      >
        <input
          {...ariaCampo('contenedor', errores.contenedor, true)}
          value={contenedor}
          maxLength={20}
          autoCapitalize="off"
          onChange={(e) => setContenedor(e.target.value)}
        />
      </Campo>

      <fieldset className="grupo">
        <legend>Vacunas que lleva el termo</legend>
        <p className="campo__ayuda">
          Todas las vacunas de un termo deben conservarse en el mismo rango de temperatura. El rango por defecto es el del{' '}
          <Sigla s="PAI" />: +2 a +8 °C.
        </p>

        {vacunas.length > 0 ? (
          <>
            <p className="rango-termo">
              Rango del termo: <strong>{formatoRango(vacunas[0].min, vacunas[0].max)}</strong>
            </p>
            <ul className="lista-vacunas">
              {vacunas.map((v, i) => (
                <Aparecer as="li" key={v.nombre} orden={i}>
                  <strong>{v.nombre}</strong>
                  <span>{formatoRango(v.min, v.max)}</span>
                  <span className={v.sensibleCongelacion ? 'etiqueta etiqueta--frio' : 'etiqueta'}>
                    {v.sensibleCongelacion ? 'Se daña si se congela' : 'No se daña por congelación'}
                  </span>
                  <button
                    type="button"
                    className="boton boton--borde boton--chico"
                    onClick={() => setVacunas(vacunas.filter((x) => x.nombre !== v.nombre))}
                    aria-label={`Quitar ${v.nombre}`}
                  >
                    Quitar
                  </button>
                </Aparecer>
              ))}
            </ul>
          </>
        ) : (
          <p className="vacio">Aún no agregas vacunas.</p>
        )}
        {errores.vacunas && (
          <p className="campo__error" role="alert">
            {errores.vacunas}
          </p>
        )}

        <div className="agregar-vacuna">
          <h3>Agregar vacuna</h3>
          <div className="fila-campos">
            <Campo id="tipo-vacuna" etiqueta="Tipo de vacuna" error={erroresVacuna.tipo}>
              <select {...ariaCampo('tipo-vacuna', erroresVacuna.tipo)} value={tipo} onChange={(e) => elegirTipo(e.target.value)}>
                <option value="">Elige una vacuna…</option>
                {disponibles.map((c) => (
                  <option key={c.nombre} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
                <option value={OTRA}>Otra vacuna…</option>
              </select>
            </Campo>
            {tipo === OTRA && (
              <Campo id="otra-vacuna" etiqueta="Nombre de la vacuna">
                <input id="otra-vacuna" value={otroNombre} maxLength={40} onChange={(e) => setOtroNombre(e.target.value)} />
              </Campo>
            )}
          </div>
          <div className="fila-campos">
            <Campo id="temp-min" etiqueta="Temperatura mínima (°C)" error={erroresVacuna.min}>
              <input {...ariaCampo('temp-min', erroresVacuna.min)} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
            </Campo>
            <Campo id="temp-max" etiqueta="Temperatura máxima (°C)" error={erroresVacuna.max}>
              <input {...ariaCampo('temp-max', erroresVacuna.max)} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
            </Campo>
          </div>
          {tipo === OTRA && (
            <label className="casilla">
              <input type="checkbox" checked={otraSensible} onChange={(e) => setOtraSensible(e.target.checked)} />
              Esta vacuna se daña si se congela
            </label>
          )}
          {tipo && tipo !== OTRA && (
            <p className="campo__ayuda">
              {buscarEnCatalogo(tipo)?.sensibleCongelacion
                ? 'Esta vacuna se daña si se congela: bajar del mínimo genera una alerta crítica.'
                : 'Esta vacuna no se daña por congelación.'}
            </p>
          )}
          {erroresVacuna.general && <Aviso tipo="error">{erroresVacuna.general}</Aviso>}
          <button type="button" className="boton boton--secundario" onClick={agregarVacuna}>
            Agregar vacuna
          </button>
        </div>
      </fieldset>

      {!enLinea && <Aviso tipo="alerta">Necesitas internet para guardar el termo.</Aviso>}
      {errorServidor && <Aviso tipo="error">{errorServidor}</Aviso>}
      <div className="acciones">
        <button type="submit" className="boton boton--primario" disabled={guardando || !enLinea}>
          {guardando ? 'Guardando…' : termo ? 'Guardar cambios' : 'Registrar termo'}
        </button>
        {onCancelar && (
          <button type="button" className="boton boton--borde" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
        )}
      </div>
    </Seccion>
  );
}

export function MiTermo() {
  const { termo, cargando, error, recargar } = useTermo();
  const [editando, setEditando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const siglas = ['PAI', 'SPR', 'BCG'] as const;

  if (cargando && !termo) return <p className="cargando">Cargando tu termo…</p>;

  if (error)
    return (
      <>
        <Titulo>Mi termo</Titulo>
        <Aviso tipo="error">{error}</Aviso>
        <button type="button" className="boton boton--primario" onClick={() => void recargar()}>
          Reintentar
        </button>
      </>
    );

  const sinVacunas = termo && termo.vacunas.length === 0;
  const mostrarFormulario = !termo || editando || sinVacunas;

  return (
    <>
      <Titulo>Mi termo</Titulo>
      <p className="subtitulo">
        Registra el termo porta-vacunas, el código de su sensor y las vacunas que lleva. Las alarmas usan el rango de
        temperatura de esas vacunas.
      </p>
      {guardado && !mostrarFormulario && (
        <Aviso tipo="exito">
          Termo guardado. Ya puedes ver su temperatura en <Link to="/">En vivo</Link>.
        </Aviso>
      )}
      {sinVacunas && !editando && (
        <Aviso tipo="alerta">
          Tu termo no tiene vacunas registradas: las alertas usan el rango <Sigla s="PAI" /> estándar de 2 a 8 °C. Agrega
          las vacunas que lleva.
        </Aviso>
      )}
      <Aparecer>
      {mostrarFormulario ? (
        <FormularioTermo
          key={termo?.deviceId ?? 'nuevo'}
          termo={termo}
          onCancelar={termo && !sinVacunas ? () => setEditando(false) : undefined}
          onGuardado={() => {
            setEditando(false);
            setGuardado(true);
          }}
        />
      ) : (
        <ResumenTermo
          termo={termo}
          onEditar={() => {
            setGuardado(false);
            setEditando(true);
          }}
        />
      )}
      </Aparecer>
      <Leyenda siglas={[...siglas]} />
    </>
  );
}
