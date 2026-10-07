const LADO_MAXIMO = 480;
const MAX_BYTES_ORIGINAL = 15 * 1024 * 1024;

/** Reduce la foto a 480 px y JPEG para que quepa en el almacenamiento del dispositivo. */
export async function comprimirFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen (foto).');
  if (archivo.size > MAX_BYTES_ORIGINAL) throw new Error('La foto pesa más de 15 MB. Toma una foto más liviana.');

  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const i = new Image();
      i.onload = () => resolver(i);
      i.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen.');
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}
