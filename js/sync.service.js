/**
 * SERVICIO SINCRONIZACIÓN (JS ES6)
 * Realiza la sincronización entre la base local SQLite y el Backend NestJS / PostgreSQL.
 *
 * IMPORTANTE: la ruta y el nombre de los campos deben coincidir EXACTO con lo que
 * espera el backend (`sincronizacion.controller.ts` → POST /sincronizacion,
 * body `{ registros: [...] }`, cada registro con los mismos nombres de columna
 * que usa `PersonaSyncDto` en el backend).
 */

import { sqliteService } from './sqlite.service.js';
import { apiService } from './api.service.js';

class SyncService {
  constructor() {
    this.estaSincronizando = false;
  }

  async obtenerPendientes() {
    return await sqliteService.query(
      "SELECT * FROM Persona WHERE estado_sincronizacion IN ('PENDING_INSERT', 'PENDING_UPDATE', 'ERROR')"
    );
  }

  /**
   * Convierte un registro de SQLite (esquema local) al formato exacto
   * que espera el backend (PersonaSyncDto).
   */
  mapearParaBackend(p) {
    return {
      numero_documento: p.numero_documento,
      id_tipo_documento: Number(p.id_tipo_documento),
      nombres: p.nombres,
      apellidos: p.apellidos,
      fecha_nacimiento: p.fecha_nacimiento,
      genero: p.genero,
      id_eps: Number(p.id_eps),
      eps_otro_nombre: p.eps_otro_nombre || undefined,
      direccion: p.direccion || undefined,
      barrio: p.barrio || undefined,
      estrato: p.estrato || undefined,
      correo: p.correo || undefined,
      estado_civil: p.estado_civil || undefined,
      telefono1: p.telefono1 || undefined,
      telefono2: p.telefono2 || undefined,
      telefono3: p.telefono3 || undefined,
      estado: p.estado_registro === 'INACTIVO' ? 'Inactivo' : 'Activo',
      estado_sincronizacion: p.estado_sincronizacion,
      fecha_actualizacion: p.fecha_actualizacion,
      version_base: p.version_base !== undefined && p.version_base !== null ? Number(p.version_base) : (p.version_persona ? Number(p.version_persona) : 1),
      version_persona: p.version_persona !== undefined && p.version_persona !== null ? Number(p.version_persona) : 1
    };
  }

  async sincronizar() {
    if (this.estaSincronizando) {
      console.log('⏳ [SyncService] Sincronización en curso. Omitiendo llamada concurrente.');
      return { exito: true, mensaje: 'Sincronización en curso.', procesados: 0 };
    }

    this.estaSincronizando = true;
    const fechaInicio = new Date().toISOString();

    try {
      const pendientes = await this.obtenerPendientes();

      if (pendientes.length === 0) {
        return { exito: true, mensaje: 'No hay registros pendientes por sincronizar.', procesados: 0 };
      }

      const payload = {
        registros: pendientes.map(p => this.mapearParaBackend(p))
      };

      console.log('📦 [SyncService] Enviando payload a POST /api/sincronizacion:', payload);

      // Ruta real del backend: POST /sincronizacion (no "/sincronizaciones/lote")
      const respuesta = await apiService.post('/sincronizacion', payload);

      const ahora = new Date().toISOString();
      const detalles = respuesta?.detalles || [];

      // El backend responde con un detalle por registro (accion: INSERT/UPDATE/ERROR/SIN_CAMBIOS/CONFLICTO).
      // Actualizamos cada registro local según lo que el backend realmente confirmó,
      // en vez de asumir que todo salió bien.
      for (const p of pendientes) {
        const detalle = detalles.find(d => d.numero_documento === p.numero_documento);
        let nuevoEstado = 'SYNCED';
        let queryParams = [nuevoEstado, ahora, p.id];
        let querySql = 'UPDATE Persona SET estado_sincronizacion = ?, fecha_actualizacion = ? WHERE id = ?';

        if (detalle) {
          if (['CONFLICT', 'CONFLICTO', 'INCONSISTENCIA'].includes(detalle.accion)) {
            nuevoEstado = 'INCONSISTENCIA';
            queryParams = [nuevoEstado, ahora, p.id];
            querySql = 'UPDATE Persona SET estado_sincronizacion = ?, fecha_actualizacion = ? WHERE id = ?';
          } else if (detalle.accion === 'ERROR') {
            nuevoEstado = 'ERROR';
            queryParams = [nuevoEstado, ahora, p.id];
            querySql = 'UPDATE Persona SET estado_sincronizacion = ?, fecha_actualizacion = ? WHERE id = ?';
          } else {
            // Éxito: INSERT / UPDATE / SIN_CAMBIOS
            nuevoEstado = 'SYNCED';
            const serverVersion = Number(detalle.version_persona || detalle.nueva_version || p.version_persona || 1);
            queryParams = [nuevoEstado, ahora, serverVersion, serverVersion, p.id];
            querySql = 'UPDATE Persona SET estado_sincronizacion = ?, fecha_actualizacion = ?, version_persona = ?, version_base = ? WHERE id = ?';
          }
        }

        await sqliteService.run(querySql, queryParams);
      }

      const fechaFin = new Date().toISOString();
      const errores = respuesta?.errores || 0;
      const nuevosCount = respuesta?.nuevos || 0;
      const actualizadosCount = respuesta?.actualizados || 0;
      // El backend no manda un contador aparte de conflictos: se cuenta
      // a partir del detalle real de cada registro (accion === 'CONFLICTO').
      const conflictosCount = detalles.filter(d => d.accion === 'CONFLICTO').length;
      const estadoLog = errores > 0 ? 'ERROR' : 'ÉXITO';
      const mensaje = errores > 0
        ? `Sincronización completada con ${errores} error(es) de ${pendientes.length} registros.`
        : `Se sincronizaron ${pendientes.length} registros exitosamente con PostgreSQL.`;

      await sqliteService.run(
        `INSERT INTO SincronizacionLog
           (fecha_inicio, fecha_fin, estado, cantidad_registros, mensaje,
            registros_nuevos, registros_actualizados, registros_error, registros_conflictos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fechaInicio, fechaFin, estadoLog, pendientes.length, mensaje,
         nuevosCount, actualizadosCount, errores, conflictosCount]
      );
      await sqliteService.guardarPersistencia();

      return { exito: errores === 0, mensaje, procesados: pendientes.length };

    } catch (error) {
      console.error('Error durante la sincronización:', error);

      const fechaFin = new Date().toISOString();
      await sqliteService.run(
        `INSERT INTO SincronizacionLog
           (fecha_inicio, fecha_fin, estado, cantidad_registros, mensaje,
            registros_nuevos, registros_actualizados, registros_error, registros_conflictos)
         VALUES (?, ?, 'ERROR', ?, ?, 0, 0, ?, 0)`,
        [fechaInicio, fechaFin, 0, error.message || 'Error de conexión', 0]
      );
      await sqliteService.guardarPersistencia();

      throw error;
    } finally {
      this.estaSincronizando = false;
    }
  }

  async obtenerUltimaSync() {
    const res = await sqliteService.query('SELECT * FROM SincronizacionLog ORDER BY id DESC LIMIT 1');
    return res.length > 0 ? res[0] : null;
  }
}

export const syncService = new SyncService();
