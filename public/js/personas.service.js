/**
 * SERVICIO PERSONAS (JS ES6)
 * Realiza las operaciones CRUD en la base de datos local SQLite.
 * Mantiene el flujo estricto Offline First y validación de documento único.
 */

import { sqliteService } from './sqlite.service.js';
import { uiService } from './ui.service.js';

class PersonasService {
  /**
   * Consulta las personas guardadas en SQLite aplicando filtros
   */
  async obtenerTodas(terminoBusqueda = '', filtroSync = 'todos', filtroEstado = 'todos') {
    let sql = 'SELECT * FROM Persona WHERE 1=1';
    const params = [];

    if (terminoBusqueda && terminoBusqueda.trim() !== '') {
      const q = `%${terminoBusqueda.trim()}%`;
      sql += ' AND (nombres LIKE ? OR apellidos LIKE ? OR numero_documento LIKE ? OR barrio LIKE ?)';
      params.push(q, q, q, q);
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
   * Guarda o actualiza una persona en SQLite (Formulario Único) con validaciones estrictas
   */
  async guardar(persona) {
    // 1. Validaciones básicas de UI
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
        : personaExistente.estado_sincronizacion || 'PENDING_UPDATE';

      const updateSQL = `
        UPDATE Persona SET
          nombres = ?,
          apellidos = ?,
          id_tipo_documento = ?,
          numero_documento = ?,
          fecha_nacimiento = ?,
          genero = ?,
          id_eps = ?,
          telefono = ?,
          barrio = ?,
          direccion = ?,
          estado_sincronizacion = ?,
          fecha_actualizacion = ?
        WHERE id = ?
      `;

      await sqliteService.run(updateSQL, [
        persona.nombres,
        persona.apellidos,
        Number(persona.id_tipo_documento),
        persona.numero_documento,
        persona.fecha_nacimiento,
        persona.genero,
        Number(persona.id_eps),
        persona.telefono || '',
        persona.barrio || '',
        persona.direccion || '',
        nuevoEstadoSync,
        ahora,
        persona.id
      ]);

      await sqliteService.guardarPersistencia();
      return persona.id;

    } else {
      // CREAR (INSERT)
      const insertSQL = `
        INSERT INTO Persona (
          nombres, apellidos, id_tipo_documento, numero_documento,
          fecha_nacimiento, genero, id_eps, telefono, barrio, direccion,
          estado_registro, estado_sincronizacion, fecha_creacion, fecha_actualizacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', 'PENDING_INSERT', ?, ?)
      `;

      const result = await sqliteService.run(insertSQL, [
        persona.nombres,
        persona.apellidos,
        Number(persona.id_tipo_documento),
        persona.numero_documento,
        persona.fecha_nacimiento,
        persona.genero,
        Number(persona.id_eps),
        persona.telefono || '',
        persona.barrio || '',
        persona.direccion || '',
        ahora,
        ahora
      ]);

      await sqliteService.guardarPersistencia();
      return result.changes?.lastId;
    }
  }

  /**
   * Inactiva el registro de una persona en SQLite
   */
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

  /**
   * Obtiene métricas resumidas desde SQLite
   */
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
