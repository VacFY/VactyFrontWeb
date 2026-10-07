import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useSesion, useUsuario } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import { useEnLinea } from '../lib/hooks';
import { nombreTermo } from '../lib/termo';
import { Aviso } from './Campo';
import { BannerAlarma, BannerConexion } from './Banners';
import BellToggle from './reactbits/BellToggle/BellToggle';
import PillNav from './reactbits/PillNav/PillNav';

/** Termo que se muestra en En vivo, Historial y Lotes: selector cuando hay más de uno. */
function SelectorTermo() {
  const { termos, termo, elegir } = useTermo();
  if (!termo) return null;
  if (termos.length === 1)
    return (
      <span className="cabecera__termo" title={`Código del termo: ${termo.contenedor}`}>
        {nombreTermo(termo)}
      </span>
    );
  return (
    <select
      className="cabecera__selector"
      aria-label="Termo que se muestra"
      value={termo.contenedor}
      onChange={(e) => elegir(e.target.value)}
    >
      {termos.map((t) => (
        <option key={t.contenedor} value={t.contenedor}>
          {nombreTermo(t)} ({t.contenedor})
        </option>
      ))}
    </select>
  );
}

export function Layout() {
  const { salir } = useSesion();
  const usuario = useUsuario();
  const { perdido, descartarPerdido } = useTermo();
  const { sonido, cambiarSonido, alertasAbiertas } = useTiempoReal();
  const enLinea = useEnLinea();
  const { pathname } = useLocation();
  const [saliendo, setSaliendo] = useState(false);
  const supervisor = usuario.rol === 'SUPERVISOR';

  const activas = alertasAbiertas.filter((a) => a.status === 'ACTIVE').length;
  const contador =
    activas > 0 ? (
      <span className="contador" aria-label={`${activas} activas`}>
        {activas}
      </span>
    ) : undefined;

  const alertas = { label: 'Alertas', href: '/alertas', extra: contador, ariaLabel: activas ? `Alertas, ${activas} activas` : undefined };
  const items = supervisor
    ? [
        { label: 'Termos', href: '/termos' },
        { label: 'En vivo', href: '/' },
        alertas,
        { label: 'Historial', href: '/historial' },
        { label: 'Lotes', href: '/lotes' },
      ]
    : [
        { label: 'En vivo', href: '/' },
        alertas,
        { label: 'Historial', href: '/historial' },
        { label: 'Lotes', href: '/lotes' },
        { label: 'Mis termos', href: '/termos' },
      ];

  async function cerrar() {
    setSaliendo(true);
    try {
      await salir();
    } catch {
      // aunque el servidor no responda, la sesión local ya se cerró
    }
  }

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cabecera__fila">
          <PillNav
            logo="/favicon.svg"
            logoText="VacTy"
            activeHref={pathname}
            baseColor="#390f07"
            pillColor="#ffde59"
            pillTextColor="#390f07"
            hoveredPillTextColor="#ffde59"
            items={items}
          />
          <div className="cabecera__acciones">
            <SelectorTermo />
            <span className={`chip ${enLinea ? 'chip--ok' : 'chip--peligro'}`} title={enLinea ? 'En línea' : 'Sin internet'}>
              <span className="chip__punto" aria-hidden="true" />
              <span className="chip__texto">{enLinea ? 'En línea' : 'Sin internet'}</span>
            </span>
            <BellToggle
              size="sm"
              label="Sonido de la alarma"
              offLabel="Sonido silenciado"
              onLabel="Sonido activado"
              pressed={sonido}
              onChange={cambiarSonido}
              color="#390f07"
              background="#fff3c2"
              onColor="#ffde59"
              onBackground="#390f07"
              badge={false}
              className="cabecera__sonido"
            />
            <Link to="/cuenta" className="cabecera__usuario" title="Mi cuenta">
              {usuario.nombre ?? usuario.dni}
              <small>{supervisor ? 'Supervisor' : 'Enfermera'}</small>
            </Link>
            <button type="button" className="boton boton--borde boton--chico" onClick={cerrar} disabled={saliendo}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <BannerConexion />
      <BannerAlarma />
      <main className="contenido">
        {perdido && (
          <div className="aviso-cerrable">
            <Aviso tipo="alerta">{perdido}</Aviso>
            <button type="button" className="boton boton--borde boton--chico" onClick={descartarPerdido}>
              Entendido
            </button>
          </div>
        )}
        {!usuario.perfilCompleto && pathname !== '/cuenta' && (
          <Aviso tipo="info">
            Completa tu nombre y tu establecimiento para que tu {supervisor ? 'equipo' : 'supervisor'} te identifique.{' '}
            <Link to="/cuenta">Completar mis datos</Link>
          </Aviso>
        )}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
