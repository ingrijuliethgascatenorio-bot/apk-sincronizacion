/**
 * SERVICIO SINCRONIZACIÓN (JS ES6)
 * Realiza la sincronización bidireccional entre la base local SQLite y el Backend NestJS / PostgreSQL
 */

import { sqliteService } from './sqlite.service.js';
import { apiService } from './api.service.js';

class SyncService {
  /**
   * Obtiene la lista de personas pendientes de sincronizar en SQLite
   */
  async obtenerPendientes() {
    return await sqliteService.query(
      "SELECT * FROM Persona WHERE estado_sincronizacion IN ('PENDING_INSERT', 'PENDING_UPDATE')"
    );
  }

  /**
   * Ejecuta la sincronización enviando datos al servidor
   */
  async sincronizar() {
    const fechaInicio = new Date().toISOString();
    const pendientes = await this.obtenerPendientes();

    if (pendientes.length === 0) {
      return { exito: true, mensaje: 'No hay registros pendientes por sincronizar.', procesados: 0 };
    }

    try {
      // 1. Enviar lote al backend NestJS (/api/sincronizaciones/lote o /api/personas/sincronizar)
      const payload = {
        personas: pendientes.map(p => ({
          id_local: p.id,
          id_remoto: p.id_remoto,
          nombres: p.nombres,
          apellidos: p.apellidos,
          id_tipo_documento: Number(p.id_tipo_documento),
          numero_documento: p.numero_documento,
          fecha_nacimiento: p.fecha_nacimiento,
          genero: p.genero,
          id_eps: Number(p.id_eps),
          telefono: p.telefono,
          barrio: p.barrio,
          direccion: p.direccion,
          estado_registro: p.estado_registro,
          estado_sincronizacion: p.estado_sincronizacion
        }))
      };

      let respuestaBackend;
      try {
        respuestaBackend = await apiService.post('/sincronizaciones/lote', payload);
      } catch (errApi) {
        // Fallback a endpoint individual si /lote no existiera
        respuestaBackend = await apiService.post('/personas/sincronizar', payload);
      }

      // 2. Actualizar estado en SQLite local a 'SYNCED'
      const ahora = new Date().toISOString();
      for (const p of pendientes) {
        const sqlUpdate = `
          UPDATE Persona SET
            estado_sincronizacion = 'SYNCED',
            fecha_actualizacion = ?
          WHERE id = ?
        `;
        await sqliteService.run(sqlUpdate, [ahora, p.id]);
      }

      // 3. Registrar log de auditoría en SQLite
      const fechaFin = new Date().toISOString();
      const insertLogSQL = `
        INSERT INTO SincronizacionLog (fecha_inicio, fecha_fin, estado, cantidad_registros, mensaje)
        VALUES (?, ?, 'ÉXITO', ?, 'Sincronización completada correctamente.')
      `;
      await sqliteService.run(insertLogSQL, [fechaInicio, fechaFin, pendientes.length]);
      await sqliteService.guardarPersistencia();

      return {
        exito: true,
        mensaje: `Se sincronizaron ${pendientes.length} registros exitosamente con PostgreSQL.`,
        procesados: pendientes.length
      };

    } catch (error) {
      console.error('Error durante la sincronización:', error);
      
      // Marcar log de error en SQLite
      const fechaFin = new Date().toISOString();
      const insertLogSQL = `
        INSERT INTO SincronizacionLog (fecha_inicio, fecha_fin, estado, cantidad_registros, mensaje)
        VALUES (?, ?, 'ERROR', ?, ?)
      `;
      await sqliteService.run(insertLogSQL, [fechaInicio, fechaFin, 0, error.message || 'Error de conexión']);
      await sqliteService.guardarPersistencia();

      throw error;
    }
  }

  /**
   * Obtiene la fecha y resumen de la última sincronización en SQLite
   */
  async obtenerUltimaSync() {
    const res = await sqliteService.query('SELECT * FROM SincronizacionLog ORDER BY id DESC LIMIT 1');
    return res.length > 0 ? res[0] : null;
  }
}

export const syncService = new SyncService();
