import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { mensajeDeError } from '../api/http';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import { Leyenda, Sigla } from '../components/Siglas';
import BlurText from '../components/reactbits/BlurText/BlurText';
import Grainient from '../components/reactbits/Grainient/Grainient';
import RotatingText from '../components/reactbits/RotatingText/RotatingText';
import ShinyText from '../components/reactbits/ShinyText/ShinyText';
import { Titulo } from '../components/Animados';
import { useSesion } from '../context/SesionContext';
import { useEnLinea } from '../lib/hooks';
import { validarContrasena, validarDni } from '../lib/validacion';

const reducirMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function MarcoAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="acceso">
      <aside className="acceso__visual">
        <div className="acceso__animacion" aria-hidden="true">
          <Grainient
            color1="#ffde59"
            color2="#390f07"
            color3="#c2410c"
            timeSpeed={reducirMovimiento ? 0 : 0.2}
            grainAmount={0.07}
            contrast={1.25}
            saturation={1.1}
            zoom={0.8}
          />
        </div>
        <div className="acceso__marca">
          <img src="/favicon.svg" alt="" width="64" height="64" />
          <BlurText as="p" text="VacTy" className="acceso__nombre" animateBy="letters" delay={90} />
        </div>
        <p className="acceso__frase">
          <span>Tu termo, siempre con</span>
          <RotatingText
            texts={['temperatura en vivo', 'alarmas al instante', 'lotes bajo control', 'registro sin internet']}
            mainClassName="acceso__rotativo"
            staggerFrom="last"
            staggerDuration={0.02}
            rotationInterval={2600}
            splitLevelClassName="acceso__rotativo-palabra"
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            auto={!reducirMovimiento}
          />
        </p>
        <p className="acceso__lema">
          <ShinyText
            text="Para el puesto de salud, del almacén de la microred a la jornada de vacunación."
            color="#fff3c2"
            shineColor="#ffffff"
            speed={3.2}
            delay={2}
            disabled={reducirMovimiento}
          />
        </p>
      </aside>
      <main className="acceso__panel">
        <div className="acceso__formulario">
          <Titulo>{titulo}</Titulo>
          {children}
          <Leyenda siglas={['DNI']} />
        </div>
      </main>
    </div>
  );
}

/** El backend gratuito tarda en "despertar": se avisa si la respuesta demora. */
function useAvisoDemora(activo: boolean): boolean {
  const [demora, setDemora] = useState(false);
  useEffect(() => {
    if (!activo) {
      setDemora(false);
      return;
    }
    const id = window.setTimeout(() => setDemora(true), 5000);
    return () => window.clearTimeout(id);
  }, [activo]);
  return demora;
}

function CampoContrasena(props: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange(v: string): void;
  error?: string | null;
  ayuda?: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo id={props.id} etiqueta={props.etiqueta} error={props.error} ayuda={props.ayuda}>
      <div className="control-con-boton">
        <input
          {...ariaCampo(props.id, props.error, !!props.ayuda)}
          type={visible ? 'text' : 'password'}
          value={props.valor}
          onChange={(e) => props.onChange(e.target.value)}
          autoComplete={props.autoComplete}
        />
        <button type="button" className="boton boton--borde boton--chico" onClick={() => setVisible((v) => !v)}>
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </Campo>
  );
}

function CampoDni({ valor, onChange, error }: { valor: string; onChange(v: string): void; error?: string | null }) {
  return (
    <Campo id="dni" etiqueta={<Sigla s="DNI" />} error={error} ayuda="8 dígitos, sin espacios.">
      <input
        {...ariaCampo('dni', error, true)}
        inputMode="numeric"
        autoComplete="username"
        maxLength={8}
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      />
    </Campo>
  );
}

export function Ingresar() {
  const { ingresar } = useSesion();
  const enLinea = useEnLinea();
  const [dni, setDni] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<{ dni?: string | null; contrasena?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const demora = useAvisoDemora(enviando);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = { dni: validarDni(dni), contrasena: contrasena ? null : 'Ingresa tu contraseña.' };
    setErrores(nuevos);
    setError(null);
    if (nuevos.dni || nuevos.contrasena) return;
    setEnviando(true);
    try {
      await ingresar(dni.trim(), contrasena);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso titulo="Iniciar sesión">
      <form onSubmit={enviar} noValidate className="formulario">
        {!enLinea && <Aviso tipo="alerta">Necesitas internet para iniciar sesión.</Aviso>}
        <CampoDni valor={dni} onChange={setDni} error={errores.dni} />
        <CampoContrasena
          id="contrasena"
          etiqueta="Contraseña"
          valor={contrasena}
          onChange={setContrasena}
          error={errores.contrasena}
          autoComplete="current-password"
        />
        {error && <Aviso tipo="error">{error}</Aviso>}
        {demora && <Aviso tipo="info">El servidor está iniciando; puede tardar hasta un minuto la primera vez.</Aviso>}
        <button type="submit" className="boton boton--primario boton--ancho" disabled={enviando || !enLinea}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="acceso__alterno">
          ¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </form>
    </MarcoAcceso>
  );
}

export function Registro() {
  const { crearCuenta } = useSesion();
  const enLinea = useEnLinea();
  const [dni, setDni] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<{ dni?: string | null; contrasena?: string | null; confirmacion?: string | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const demora = useAvisoDemora(enviando);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = {
      dni: validarDni(dni),
      contrasena: validarContrasena(contrasena),
      confirmacion: !confirmacion
        ? 'Repite la contraseña.'
        : confirmacion !== contrasena
          ? 'Las contraseñas no coinciden.'
          : null,
    };
    setErrores(nuevos);
    setError(null);
    if (nuevos.dni || nuevos.contrasena || nuevos.confirmacion) return;
    setEnviando(true);
    try {
      await crearCuenta(dni.trim(), contrasena);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso titulo="Crear cuenta">
      <form onSubmit={enviar} noValidate className="formulario">
        {!enLinea && <Aviso tipo="alerta">Necesitas internet para crear tu cuenta.</Aviso>}
        <CampoDni valor={dni} onChange={setDni} error={errores.dni} />
        <CampoContrasena
          id="contrasena"
          etiqueta="Contraseña"
          valor={contrasena}
          onChange={setContrasena}
          error={errores.contrasena}
          ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
          autoComplete="new-password"
        />
        <CampoContrasena
          id="confirmacion"
          etiqueta="Repite la contraseña"
          valor={confirmacion}
          onChange={setConfirmacion}
          error={errores.confirmacion}
          autoComplete="new-password"
        />
        {error && <Aviso tipo="error">{error}</Aviso>}
        {demora && <Aviso tipo="info">El servidor está iniciando; puede tardar hasta un minuto la primera vez.</Aviso>}
        <button type="submit" className="boton boton--primario boton--ancho" disabled={enviando || !enLinea}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="acceso__alterno">
          ¿Ya tienes cuenta? <Link to="/ingresar">Iniciar sesión</Link>
        </p>
      </form>
    </MarcoAcceso>
  );
}
