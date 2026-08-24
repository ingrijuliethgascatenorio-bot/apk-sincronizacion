/**
 * SERVICIO PERSONAS (JS ES6)
 * Realiza las operaciones CRUD en la base de datos local SQLite.
 * Mantiene el flujo estricto Offline First y validación de documento único.
 * Alineado con los campos que espera el backend NestJS al sincronizar.
 */

import { sqliteService } from './sqlite.service.js';
import { uiService } from './ui.service.js';

export const ID_EPS_OTRO = 99;

class PersonasService {
  async obtenerTodas(terminoBusqueda = '', filtroSync = 'todos', filtroEstado = 'todos') {
    let sql = 'SELECT * FROM Persona WHERE 1=1';
    const params = [];

    if (terminoBusqueda && terminoBusqueda.trim() !== '') {
      const q = `%${terminoBusqueda.trim().toLowerCase()}%`;
      sql += ` AND (
        LOWER(nombres) LIKE ? OR LOWER(apellidos) LIKE ? OR
        LOWER(numero_documento) LIKE ? OR LOWER(COALESCE(barrio,'')) LIKE ? OR
        LOWER(COALESCE(correo,'')) LIKE ?
      )`;
      params.push(q, q, q, q, q);
    }

    if (filtroSync === 'sincronizados') {
      sql += " AND estado_sincronizacion = 'SYNCED'";
    } else if (filtroSync === 'pendientes') {
      sql += " AND estado_sincronizacion IN ('PENDING_INSERT', 'PENDING_UPDATE')";
    } else if (filtroSync === 'errores') {
      sql += " AND estado_sincronizacion = 'ERROR'";
    }

    if (filtroEstado === 'activo') {
      sql += " AND estado_registro = 'ACTIVO'";
    } else if (filtroEstado === 'inactivo') {
      sql += " AND estado_registro = 'INACTIVO'";
    }

    sql += ' ORDER BY fecha_actualizacion DESC';
    return await sqliteService.query(sql, params);
  }

  async obtenerPorId(id) {
    const res = await sqliteService.query('SELECT * FROM Persona WHERE id = ?', [id]);
    return res.length > 0 ? res[0] : null;
  }

  async obtenerPorDocumento(numeroDocumento) {
    const res = await sqliteService.query('SELECT * FROM Persona WHERE numero_documento = ?', [numeroDocumento]);
    return res.length > 0 ? res[0] : null;
  }

  /**
   * Calcula la rotación de teléfonos (RN-06): el nuevo entra a telefono1,
   * lo que había en telefono1 pasa a telefono2, lo que había en telefono2
   * pasa a telefono3, y lo que había en telefono3 se descarta.
   * Si el teléfono nuevo es igual al que ya estaba en telefono1, no rota.
   */
  calcularRotacionTelefonos(existente, telefonoNuevo) {
    const t1Actual = existente?.telefono1 || '';
    if (!telefonoNuevo || telefonoNuevo === t1Actual) {
      return {
        telefono1: existente?.telefono1 || '',
        telefono2: existente?.telefono2 || '',
        telefono3: existente?.telefono3 || ''
      };
    }
    return {
      telefono1: telefonoNuevo,
      telefono2: existente?.telefono1 || '',
      telefono3: existente?.telefono2 || ''
    };
  }

  /**
   * Guarda o actualiza una persona en SQLite (Formulario Único) con validaciones estrictas
   */
  async guardar(persona) {
    // 1. Validaciones de formulario (documento numérico, correo, teléfono, etc.)
    uiService.validarFormularioPersona(persona);

    // 2. Validación de Documento Único
    const existeDoc = await this.obtenerPorDocumento(persona.numero_documento);
    if (existeDoc && (!persona.id || Number(existeDoc.id) !== Number(persona.id))) {
      throw new Error(`El número de documento ${persona.numero_documento} ya se encuentra registrado.`);
    }

    const ahora = new Date().toISOString();

    if (persona.id) {
      // ACTUALIZAR (UPDATE)
      const personaExistente = await this.obtenerPorId(persona.id);
      const nuevoEstadoSync = (personaExistente && personaExistente.estado_sincronizacion === 'SYNCED')
        ? 'PENDING_UPDATE'
        : (personaExistente?.estado_sincronizacion || 'PENDING_UPDATE');

      const telefonos = this.calcularRotacionTelefonos(personaExistente, persona.telefono1);
      const epsOtroNombre = Number(persona.id_eps) === ID_EPS_OTRO ? (persona.eps_otro_nombre || '') : '';

      const updateSQL = `
        UPDATE Persona SET
          nombres = ?, apellidos = ?, id_tipo_documento = ?, numero_documento = ?,
          fecha_nacimiento = ?, genero = ?, id_eps = ?, eps_otro_nombre = ?,
          telefono1 = ?, telefono2 = ?, telefono3 = ?,
          correo = ?, estrato = ?, estado_civil = ?,
          barrio = ?, direccion = ?,
          estado_sincronizacion = ?, fecha_actualizacion = ?
        WHERE id = ?
      `;

      await sqliteService.run(updateSQL, [
        persona.nombres, persona.apellidos, Number(persona.id_tipo_documento), persona.numero_documento,
        persona.fecha_nacimiento, persona.genero, Number(persona.id_eps), epsOtroNombre,
        telefonos.telefono1, telefonos.telefono2, telefonos.telefono3,
        persona.correo || '', persona.estrato || '', persona.estado_civil || '',
        persona.barrio || '', persona.direccion || '',
        nuevoEstadoSync, ahora,
        persona.id
      ]);

      await sqliteService.guardarPersistencia();
      return persona.id;

    } else {
      // CREAR (INSERT)
      const epsOtroNombre = Number(persona.id_eps) === ID_EPS_OTRO ? (persona.eps_otro_nombre || '') : '';

      const insertSQL = `
        INSERT INTO Persona (
          nombres, apellidos, id_tipo_documento, numero_documento,
          fecha_nacimiento, genero, id_eps, eps_otro_nombre,
          telefono1, telefono2, telefono3,
          correo, estrato, estado_civil,
          barrio, direccion,
          estado_registro, estado_sincronizacion, fecha_creacion, fecha_actualizacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', 'PENDING_INSERT', ?, ?)
      `;

      const result = await sqliteService.run(insertSQL, [
        persona.nombres, persona.apellidos, Number(persona.id_tipo_documento), persona.numero_documento,
        persona.fecha_nacimiento, persona.genero, Number(persona.id_eps), epsOtroNombre,
        persona.telefono1 || '', '', '',
        persona.correo || '', persona.estrato || '', persona.estado_civil || '',
        persona.barrio || '', persona.direccion || '',
        ahora, ahora
      ]);

      await sqliteService.guardarPersistencia();
      return result.changes?.lastId;
    }
  }

  async inactivar(id) {
    const ahora = new Date().toISOString();
    const sql = `
      UPDATE Persona SET
        estado_registro = 'INACTIVO',
        estado_sincronizacion = 'PENDING_UPDATE',
        fecha_actualizacion = ?
      WHERE id = ?
    `;
    await sqliteService.run(sql, [ahora, id]);
    await sqliteService.guardarPersistencia();
  }

  async obtenerMetricas() {
    const total = await sqliteService.query('SELECT COUNT(*) as c FROM Persona');
    const synced = await sqliteService.query("SELECT COUNT(*) as c FROM Persona WHERE estado_sincronizacion = 'SYNCED'");
    const pending = await sqliteService.query("SELECT COUNT(*) as c FROM Persona WHERE estado_sincronizacion IN ('PENDING_INSERT', 'PENDING_UPDATE')");
    const errors = await sqliteService.query("SELECT COUNT(*) as c FROM Persona WHERE estado_sincronizacion = 'ERROR'");

    return {
      total: total[0]?.c || 0,
      synced: synced[0]?.c || 0,
      pending: pending[0]?.c || 0,
      errors: errors[0]?.c || 0
    };
  }
}

export const personasService = new PersonasService();
