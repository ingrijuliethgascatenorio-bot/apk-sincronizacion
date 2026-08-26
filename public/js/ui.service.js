/**
 * SERVICIO UI Y VALIDACIONES (JS ES6)
 * Gestiona alertas, toasts, modales y validaciones de formularios
 */

class UiService {
  mostrarAlerta(mensaje, titulo = 'Atención') {
    alert(`${titulo}\n\n${mensaje}`);
  }

  validarCorreo(email) {
    if (!email) return true; // Opcional
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  validarTelefono(telefono) {
    if (!telefono) return true; // Opcional
    const re = /^[0-9+\s-]{7,15}$/;
    return re.test(String(telefono));
  }

  validarFormularioPersona(persona) {
    if (!persona.nombres || persona.nombres.trim() === '') {
      throw new Error('El campo Nombres es obligatorio.');
    }
    if (!persona.apellidos || persona.apellidos.trim() === '') {
      throw new Error('El campo Apellidos es obligatorio.');
    }
    if (!persona.numero_documento || persona.numero_documento.trim() === '') {
      throw new Error('El campo Número de Documento es obligatorio.');
    }
    if (!persona.fecha_nacimiento) {
      throw new Error('La Fecha de Nacimiento es obligatoria.');
    }
    if (persona.telefono && !this.validarTelefono(persona.telefono)) {
      throw new Error('El número de teléfono/celular no tiene un formato válido.');
    }
    return true;
  }
}

export const uiService = new UiService();
