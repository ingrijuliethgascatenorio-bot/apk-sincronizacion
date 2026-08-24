/**
 * SERVICIO REPORTES (JS ES6)
 * Genera resúmenes y estadísticas consolidando información de SQLite
 */

import { sqliteService } from './sqlite.service.js';

class ReportesService {
  /**
   * Obtiene la distribución de personas agrupadas por estado y EPS
   */
  async obtenerReporteGeneral() {
    const total = await sqliteService.query('SELECT COUNT(*) as cant FROM Persona');
    const activos = await sqliteService.query("SELECT COUNT(*) as cant FROM Persona WHERE estado_registro = 'ACTIVO'");
    const inactivos = await sqliteService.query("SELECT COUNT(*) as cant FROM Persona WHERE estado_registro = 'INACTIVO'");
    
    return {
      total: total[0]?.cant || 0,
      activos: activos[0]?.cant || 0,
      inactivos: inactivos[0]?.cant || 0
    };
  }
}

export const reportesService = new ReportesService();
