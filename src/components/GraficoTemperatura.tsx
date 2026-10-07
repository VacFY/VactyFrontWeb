import { useId } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatoFechaHora, formatoHora, formatoTemp } from '../lib/format';

export interface PuntoGrafico {
  t: number;
  temperatura: number | null;
}

interface Props {
  puntos: PuntoGrafico[];
  min: number;
  max: number;
  alto?: number;
  /** Mostrar fecha además de la hora en el eje (rangos de varios días). */
  conFecha?: boolean;
  /** Dibuja la línea con animación (para consultas, no para datos en vivo que llegan cada 2 s). */
  animar?: boolean;
}

export function GraficoTemperatura({ puntos, min, max, alto = 280, conFecha = false, animar = false }: Props) {
  const idDegradado = useId().replace(/:/g, '');
  const valores = puntos.map((p) => p.temperatura).filter((v): v is number => v != null);
  const piso = Math.floor(Math.min(min - 2, ...valores));
  const techo = Math.ceil(Math.max(max + 2, ...valores));
  const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const animado = animar && !reducir;

  return (
    <div className="grafico" role="img" aria-label={`Gráfico de temperatura. Rango seguro de ${min} a ${max} °C.`}>
      <ResponsiveContainer width="100%" height={alto}>
        <ComposedChart data={puntos} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
          <defs>
            <linearGradient id={idDegradado} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffde59" stopOpacity={0.75} />
              <stop offset="100%" stopColor="#ffde59" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#390f0714" vertical={false} />
          <ReferenceArea y1={min} y2={max} fill="#2e7d32" fillOpacity={0.08} stroke="none" ifOverflow="extendDomain" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) =>
              conFecha
                ? new Date(t).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' ' + formatoHora(t)
                : formatoHora(t)
            }
            tick={{ fill: '#7a5247', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            domain={[piso, techo]}
            unit="°"
            tick={{ fill: '#7a5247', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={44}
          />
          <Tooltip
            labelFormatter={(t) => formatoFechaHora(Number(t))}
            formatter={(v) => [formatoTemp(v as number), 'Temperatura']}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 30px -10px #390f0766', fontWeight: 700 }}
            cursor={{ stroke: '#390f07', strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="temperatura"
            stroke="none"
            fill={`url(#${idDegradado})`}
            connectNulls={false}
            isAnimationActive={animado}
            animationDuration={1100}
          />
          <Line
            type="monotone"
            dataKey="temperatura"
            stroke="#390f07"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6, fill: '#ffde59', stroke: '#390f07', strokeWidth: 3 }}
            connectNulls={false}
            isAnimationActive={animado}
            animationDuration={1100}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="grafico__leyenda">
        <span className="grafico__muestra grafico__muestra--rango" /> Rango seguro ({min} a {max} °C)
        <span className="grafico__muestra grafico__muestra--linea" /> Temperatura
      </p>
    </div>
  );
}
