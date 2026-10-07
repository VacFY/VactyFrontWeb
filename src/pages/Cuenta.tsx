import { useEffect, useState, type FormEvent } from 'react';
import { mensajeDeError } from '../api/http';
import { obtenerPerfil } from '../api/servicios';
import { Seccion, Titulo } from '../components/Animados';
import { ariaCampo, Aviso, Campo } from '../components/Campo';
import { textoPerfil, useSesion, useUsuario } from '../context/SesionContext';
import { useEnLinea } from '../lib/hooks';
import { validarTextoPerfil } from '../lib/validacion';

export function Cuenta() {
  const { guardarDatos } = useSesion();
  const usuario = useUsuario();
  const enLinea = useEnLinea();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [establecimiento, setEstablecimiento] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string | null; apellido?: string | null; establecimiento?: string | null }>({});
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'exito'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obtenerPerfil()
      .then((p) => {
        setNombre(textoPerfil(p.profileName));
        setApellido(textoPerfil(p.profileLastName));
        setEstablecimiento(textoPerfil(p.profileCompany));
      })
      .catch(() => {
        // sin conexión o sin perfil: el formulario empieza vacío
      });
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const nuevos = {
      nombre: validarTextoPerfil(nombre, 'nombre'),
      apellido: validarTextoPerfil(apellido, 'apellido'),
      establecimiento: validarTextoPerfil(establecimiento, 'establecimiento'),
    };
    setErrores(nuevos);
    setMensaje(null);
    if (nuevos.nombre || nuevos.apellido || nuevos.establecimiento) return;
    setEnviando(true);
    try {
      await guardarDatos({ nombre: nombre.trim(), apellido: apellido.trim(), establecimiento: establecimiento.trim() });
      setMensaje({ tipo: 'exito', texto: 'Datos guardados.' });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: mensajeDeError(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Titulo>Mi cuenta</Titulo>
      <p className="subtitulo">
        DNI {usuario.dni} · {usuario.rol === 'SUPERVISOR' ? 'Supervisor: ve y administra todos los termos.' : 'Enfermera: ve los termos que tiene vinculados.'}
      </p>
      <Seccion as="form" className="formulario" onSubmit={enviar} noValidate>
        <h2>Tus datos</h2>
        <div className="fila-campos">
          <Campo id="cuenta-nombre" etiqueta="Nombre" error={errores.nombre}>
            <input {...ariaCampo('cuenta-nombre', errores.nombre)} value={nombre} maxLength={60} autoComplete="given-name" onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo id="cuenta-apellido" etiqueta="Apellido" error={errores.apellido}>
            <input {...ariaCampo('cuenta-apellido', errores.apellido)} value={apellido} maxLength={60} autoComplete="family-name" onChange={(e) => setApellido(e.target.value)} />
          </Campo>
        </div>
        <Campo id="cuenta-establecimiento" etiqueta="Establecimiento" error={errores.establecimiento} ayuda="Por ejemplo: Posta Santa Rosa o Microred Huambos.">
          <input
            {...ariaCampo('cuenta-establecimiento', errores.establecimiento, true)}
            value={establecimiento}
            maxLength={60}
            autoComplete="organization"
            onChange={(e) => setEstablecimiento(e.target.value)}
          />
        </Campo>
        {!enLinea && <Aviso tipo="alerta">Necesitas internet para guardar tus datos.</Aviso>}
        {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
        <div className="acciones">
          <button type="submit" className="boton boton--primario" disabled={enviando || !enLinea}>
            {enviando ? 'Guardando…' : 'Guardar datos'}
          </button>
        </div>
      </Seccion>
    </>
  );
}
