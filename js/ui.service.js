/**
 * SERVICIO UI Y VALIDACIONES (JS ES6)
 * Gestiona alertas, toasts, modales y validaciones de formularios
 */

import { personasService, ID_EPS_OTRO } from './personas.service.js';

class UiService {
  mostrarAlerta(mensaje, titulo = 'Atención') {
    alert(`${titulo}\n\n${mensaje}`);
  }

  validarCorreo(email) {
    if (!email) return true; // Opcional
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  validarSoloNumeros(valor) {
    return /^[0-9]+$/.test(String(valor || ''));
  }

  validarSoloLetras(valor) {
    return /^[a-zA-ZÀ-ÿñÑ\s]+$/.test(String(valor || ''));
  }

  validarTelefono(telefono) {
    if (!telefono) return true; // Opcional
    return /^[0-9]{7,10}$/.test(String(telefono));
  }

  validarFormularioPersona(persona) {
    const doc = (persona.numero_documento || '').toString().trim();
    if (!doc) {
      throw new Error('El número de documento es obligatorio.');
    }
    if (!this.validarSoloNumeros(doc)) {
      throw new Error('El número de documento solo puede contener números.');
    }
    if (doc.length < 6 || doc.length > 10) {
      throw new Error('El número de documento debe tener entre 6 y 10 dígitos.');
    }

    const nombres = (persona.nombres || '').trim();
    if (!nombres) {
      throw new Error('El campo Nombres es obligatorio.');
    }
    if (!this.validarSoloLetras(nombres)) {
      throw new Error('El campo Nombres solo puede contener letras.');
    }

    const apellidos = (persona.apellidos || '').trim();
    if (!apellidos) {
      throw new Error('El campo Apellidos es obligatorio.');
    }
    if (!this.validarSoloLetras(apellidos)) {
      throw new Error('El campo Apellidos solo puede contener letras.');
    }

    if (!persona.fecha_nacimiento) {
      throw new Error('La Fecha de Nacimiento es obligatoria.');
    }
    if (new Date(persona.fecha_nacimiento) > new Date()) {
      throw new Error('La Fecha de Nacimiento no puede ser una fecha futura.');
    }

    if (persona.estrato) {
      const estratoNum = Number(persona.estrato);
      if (!Number.isInteger(estratoNum) || estratoNum < 1 || estratoNum > 6) {
        throw new Error('El estrato debe ser un número entre 1 y 6.');
      }
    }

    if (persona.correo && !this.validarCorreo(persona.correo)) {
      throw new Error('El correo electrónico no tiene un formato válido.');
    }

    if (persona.telefono1 && !this.validarTelefono(persona.telefono1)) {
      throw new Error('El teléfono debe tener entre 7 y 10 dígitos, solo números.');
    }

    if (!persona.id_eps) {
      throw new Error('Debes seleccionar una EPS.');
    }
    if (Number(persona.id_eps) === ID_EPS_OTRO && !persona.eps_otro_nombre?.trim()) {
      throw new Error('Escribe el nombre de la EPS en el campo "¿Cuál EPS?".');
    }

    if (!persona.id_tipo_documento) {
      throw new Error('Debes seleccionar un Tipo de Documento.');
    }

    return true;
  }
}

export const uiService = new UiService();
