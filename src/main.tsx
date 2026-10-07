import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/plus-jakarta-sans';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

// Guarda la app en el dispositivo para que abra aunque no haya internet.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
