/**
 * SERVICIO HISTORIAL (JS ES6)
 * Consulta el historial de actividades de sincronización desde SQLite local
 */

import { sqliteService } from './sqlite.service.js';

class HistorialService {
  /**
   * Obtiene todos los registros del historial de sincronizaciones
   */
  async obtenerHistorial() {
    return await sqliteService.query(
      'SELECT * FROM SincronizacionLog ORDER BY id DESC'
    );
  }
}

export const historialService = new HistorialService();
