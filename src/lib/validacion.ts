export function validarDni(dni: string): string | null {
  if (!dni.trim()) return 'Ingresa tu DNI.';
  if (!/^\d{8}$/.test(dni.trim())) return 'El DNI debe tener exactamente 8 dígitos.';
  return null;
}

/** El backend usa bcrypt: más de 72 bytes da error. */
export function validarContrasena(contrasena: string): string | null {
  if (!contrasena) return 'Ingresa una contraseña.';
  if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (new TextEncoder().encode(contrasena).length > 72) return 'La contraseña es demasiado larga (máximo 72 caracteres).';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(contrasena) || !/\d/.test(contrasena))
    return 'La contraseña debe tener al menos una letra y un número.';
  return null;
}

/** Nombre, apellido o establecimiento del perfil: el backend no acepta campos vacíos. */
export function validarTextoPerfil(valor: string, campo: string): string | null {
  const v = valor.trim();
  if (!v) return `Ingresa tu ${campo}.`;
  if (v.length > 60) return `Tu ${campo} admite máximo 60 caracteres.`;
  if (v.toLowerCase() === 'undefined') return `Escribe tu ${campo} real.`;
  return null;
}
