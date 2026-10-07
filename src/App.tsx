import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SesionProvider, useSesion } from './context/SesionContext';
import { TermoProvider } from './context/TermoContext';
import { TiempoRealProvider } from './context/TiempoRealContext';
import { Ingresar, Registro } from './pages/Acceso';
import { Alertas } from './pages/Alertas';
import { Cuenta } from './pages/Cuenta';
import { EnVivo } from './pages/EnVivo';
import { Historial } from './pages/Historial';
import { Lotes } from './pages/Lotes';
import { Termos } from './pages/Termos';

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
  // key: al cambiar de cuenta o de rol se reinician los datos en memoria.
  return (
    <TermoProvider key={`${sesion.dni}:${sesion.rol}`}>
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
  // El supervisor empieza en la lista de termos; quien acaba de crear su cuenta, en vincular su termo.
  if (sesion.tipo === 'autenticado')
    return <Navigate to={sesion.rol === 'SUPERVISOR' || pathname === '/registro' ? '/termos' : '/'} replace />;
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
              <Route path="termos" element={<Termos />} />
              <Route path="cuenta" element={<Cuenta />} />
              <Route path="termo" element={<Navigate to="/termos" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SesionProvider>
  );
}
