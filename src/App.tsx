import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SesionProvider, useSesion } from './context/SesionContext';
import { TermoProvider } from './context/TermoContext';
import { TiempoRealProvider } from './context/TiempoRealContext';
import { Ingresar, Registro } from './pages/Acceso';
import { Alertas } from './pages/Alertas';
import { EnVivo } from './pages/EnVivo';
import { Historial } from './pages/Historial';
import { Lotes } from './pages/Lotes';
import { MiTermo } from './pages/MiTermo';

function PantallaCarga() {
  return (
    <div className="pantalla-carga" role="status">
      <img src="/favicon.svg" alt="" width="56" height="56" />
      <p>Cargando VacTy…</p>
    </div>
  );
}

function SoloConSesion() {
  const { sesion } = useSesion();
  if (sesion.tipo === 'cargando') return <PantallaCarga />;
  if (sesion.tipo === 'anonimo') return <Navigate to="/ingresar" replace />;
  // key: al cambiar de cuenta se reinician los datos en memoria.
  return (
    <TermoProvider key={sesion.dni}>
      <TiempoRealProvider>
        <Outlet />
      </TiempoRealProvider>
    </TermoProvider>
  );
}

function SoloSinSesion() {
  const { sesion } = useSesion();
  const { pathname } = useLocation();
  if (sesion.tipo === 'cargando') return <PantallaCarga />;
  // Quien acaba de crear su cuenta va directo a registrar su termo.
  if (sesion.tipo === 'autenticado') return <Navigate to={pathname === '/registro' ? '/termo' : '/'} replace />;
  return <Outlet />;
}

export function App() {
  return (
    <SesionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SoloSinSesion />}>
            <Route path="/ingresar" element={<Ingresar />} />
            <Route path="/registro" element={<Registro />} />
          </Route>
          <Route element={<SoloConSesion />}>
            <Route element={<Layout />}>
              <Route index element={<EnVivo />} />
              <Route path="alertas" element={<Alertas />} />
              <Route path="historial" element={<Historial />} />
              <Route path="lotes" element={<Lotes />} />
              <Route path="termo" element={<MiTermo />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
