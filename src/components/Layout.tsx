import { useState } from 'react';
import { motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSesion } from '../context/SesionContext';
import { useTermo } from '../context/TermoContext';
import { useTiempoReal } from '../context/TiempoRealContext';
import { useEnLinea } from '../lib/hooks';
import { BannerAlarma, BannerConexion } from './Banners';
import BellToggle from './reactbits/BellToggle/BellToggle';
import PillNav from './reactbits/PillNav/PillNav';

export function Layout() {
  const { salir } = useSesion();
  const { termo } = useTermo();
  const { sonido, cambiarSonido, alertasAbiertas } = useTiempoReal();
  const enLinea = useEnLinea();
  const { pathname } = useLocation();
  const [saliendo, setSaliendo] = useState(false);

  const activas = alertasAbiertas.filter((a) => a.status === 'ACTIVE').length;
  const contador =
    activas > 0 ? (
      <span className="contador" aria-label={`${activas} activas`}>
        {activas}
      </span>
    ) : undefined;

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
            items={[
              { label: 'En vivo', href: '/' },
              { label: 'Alertas', href: '/alertas', extra: contador, ariaLabel: activas ? `Alertas, ${activas} activas` : undefined },
              { label: 'Historial', href: '/historial' },
              { label: 'Lotes', href: '/lotes' },
              { label: 'Mi termo', href: '/termo' },
            ]}
          />
          <div className="cabecera__acciones">
            {termo && (
              <span className="cabecera__termo" title={`Código del sensor: ${termo.contenedor}`}>
                {termo.nombre}
              </span>
            )}
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
            <button type="button" className="boton boton--borde boton--chico" onClick={cerrar} disabled={saliendo}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <BannerConexion />
      <BannerAlarma />
      <main className="contenido">
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
