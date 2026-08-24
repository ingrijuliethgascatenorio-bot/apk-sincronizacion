/**
 * SERVICIO REPORTES (JS ES6)
 * Conecta el frontend con la API del backend NestJS para reportes centralizados
 */

import { apiService } from './api.service.js';
import { sqliteService } from './sqlite.service.js';

class ReportesService {
  /**
   * Obtiene la distribución local en SQLite (encuestador offline stats)
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

  /**
   * Obtiene la lista de sincronizaciones centralizadas desde el backend NestJS (paginadas)
   */
  async listarSincronizaciones(pagina = 1, limite = 10) {
    try {
      return await apiService.get(`/historial/sincronizaciones?pagina=${pagina}&limite=${limite}`);
    } catch (e) {
      console.error('Error al listar sincronizaciones del backend:', e);
      throw e;
    }
  }

  /**
   * Obtiene el detalle de una sincronización específica
   */
  async obtenerDetalleSincronizacion(id) {
    try {
      return await apiService.get(`/historial/sincronizaciones/${id}`);
    } catch (e) {
      console.error(`Error al obtener detalle de sincronizacion ${id}:`, e);
      throw e;
    }
  }

  /**
   * Descarga el reporte en formato Blob del servidor
   */
  async descargarReporteBlob(id, formato = 'pdf') {
    const token = localStorage.getItem('auth_token');
    const url = apiService.buildUrl(`/reportes/sincronizacion/${id}/${formato}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': '69420'
      }
    });

    if (!response.ok) {
      throw new Error(`Error al descargar reporte ${formato.toUpperCase()}: ${response.statusText}`);
    }

    return await response.blob();
  }
}

export const reportesService = new ReportesService();
