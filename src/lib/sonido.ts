// Sonido de alarma generado con Web Audio (no requiere archivos). Los navegadores solo
// permiten reproducir audio después de una interacción del usuario, por eso existe prepararAudio().
let contexto: AudioContext | null = null;

export function prepararAudio(): void {
  try {
    contexto ??= new AudioContext();
    if (contexto.state === 'suspended') void contexto.resume();
  } catch {
    contexto = null;
  }
}

export function audioDisponible(): boolean {
  return contexto?.state === 'running';
}

/** Dos tonos cortos, agudos y fáciles de distinguir. */
export function sonarPitido(): void {
  if (!contexto || contexto.state !== 'running') return;
  const ahora = contexto.currentTime;
  [0, 0.3].forEach((retraso, i) => {
    const osc = contexto!.createOscillator();
    const vol = contexto!.createGain();
    osc.type = 'square';
    osc.frequency.value = i === 0 ? 880 : 660;
    vol.gain.setValueAtTime(0.0001, ahora + retraso);
    vol.gain.exponentialRampToValueAtTime(0.25, ahora + retraso + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, ahora + retraso + 0.25);
    osc.connect(vol).connect(contexto!.destination);
    osc.start(ahora + retraso);
    osc.stop(ahora + retraso + 0.27);
  });
}
