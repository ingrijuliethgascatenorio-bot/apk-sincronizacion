/**
 * SERVICIO REPORTES (JS ES6)
 * Conecta el frontend con la API del backend NestJS para reportes centralizados
 */

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
  async listarSincronizaciones(pagina = 1, limite = 10, filtros = {}) {
    try {
      const params = new URLSearchParams();
      params.append('pagina', pagina);
      params.append('limite', limite);

      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.estado) params.append('estado', filtros.estado);
      if (filtros.fechaDesde) params.append('fecha_desde', filtros.fechaDesde);
      if (filtros.fechaHasta) params.append('fecha_hasta', filtros.fechaHasta);

      return await apiService.get(`/historial/sincronizaciones?${params.toString()}`);
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

  /**
   * Guarda el PDF/TXT en las Descargas del almacenamiento nativo de Android
   */
  async guardarReporteEnDispositivo(id, formato = 'pdf') {
    const blob = await this.descargarReporteBlob(id, formato);
    const filename = `reporte_sync_${id}.${formato}`;
    const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();

    if (isCapacitor) {
      try {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Error al procesar el archivo a Base64'));
          reader.onload = () => {
            const res = reader.result;
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.readAsDataURL(blob);
        });

        let writeResult;
        try {
          writeResult = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
          });
        } catch (e1) {
          writeResult = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: Directory.ExternalStorage,
            recursive: true
          });
        }

        console.log('PDF guardado nativamente:', writeResult.uri);

        try {
          await Share.share({
            title: `Reporte de Sincronización #${id}`,
            text: `Reporte ${filename} guardado.`,
            url: writeResult.uri,
            dialogTitle: 'Guardar / Abrir Reporte PDF'
          });
        } catch (shareErr) {
          console.warn('Share no disponible:', shareErr);
        }

        return {
          exito: true,
          ruta: writeResult.uri || `/Download/${filename}`,
          filename
        };
      } catch (errNativo) {
        console.error('Error al guardar reporte nativo:', errNativo);
        throw new Error(`No fue posible descargar el reporte en Android: ${errNativo.message || errNativo}`);
      }
    } else {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      return {
        exito: true,
        ruta: `Descargas/${filename}`,
        filename
      };
    }
  }
}

export const reportesService = new ReportesService();
