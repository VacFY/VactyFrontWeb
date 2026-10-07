import { infoVvm, TONO_CIRCULO_VVM, type EtapaVvm } from '../lib/lotes';

export function IlustracionVvm({ etapa, tamano = 44 }: { etapa: EtapaVvm; tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 40 40" aria-hidden="true" className="vvm-ilustracion">
      <circle cx="20" cy="20" r="18" fill={TONO_CIRCULO_VVM} />
      <rect x="11" y="11" width="18" height="18" fill={infoVvm(etapa).tonoCuadrado} stroke="#00000033" />
    </svg>
  );
}
