/**
 * SERVICIO API REST (JS ES6)
 * Utiliza exclusivamente la URL definida en config.js.
 */

import { CONFIG } from './config.js';

class ApiService {
  constructor() {
    this.baseUrl = CONFIG.API_URL;
    console.log('📡 [ApiService] URL Backend configurada desde config.js:', this.baseUrl);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': '69420'
    };
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  buildUrl(endpoint) {
    const base = this.baseUrl.replace(/\/$/, '');
    const path = endpoint.replace(/^\//, '');
    return `${base}/${path}`;
  }

  /**
   * fetch() con timeout: en un WebView Android, si el DNS o el TLS handshake
   * se cuelgan (dominio mal resuelto, certificado inválido, firewall que
   * descarta paquetes en vez de rechazarlos), fetch() puede quedar colgado
   * indefinidamente en vez de lanzar un error. Sin este timeout el usuario
   * ve la rueda de "Sincronizando..." girar para siempre y no un mensaje de
   * error claro.
   */
  async fetchConTimeout(url, opciones, timeoutMs = 15000) {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      return await fetch(url, { ...opciones, signal: controlador.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async get(endpoint) {
    const url = this.buildUrl(endpoint);
    console.log(`🌐 [HTTP GET] ${url}`);
    try {
      const response = await this.fetchConTimeout(url, {
        method: 'GET',
        headers: this.getHeaders()
      });
      console.log(`📥 [HTTP ${response.status}] ${url}`);
      return await this.procesarRespuesta(response);
    } catch (err) {
      console.error(`💥 [HTTP ERROR GET] ${url}:`, err);
      this.manejarErrorRed(err, url);
    }
  }

  async post(endpoint, body = {}) {
    const url = this.buildUrl(endpoint);
    console.log(`🌐 [HTTP POST] ${url}`, body);
    try {
      const response = await this.fetchConTimeout(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      console.log(`📥 [HTTP ${response.status}] ${url}`);
      return await this.procesarRespuesta(response);
    } catch (err) {
      console.error(`💥 [HTTP ERROR POST] ${url}:`, err);
      this.manejarErrorRed(err, url);
    }
  }

  async put(endpoint, body = {}) {
    const url = this.buildUrl(endpoint);
    console.log(`🌐 [HTTP PUT] ${url}`, body);
    try {
      const response = await this.fetchConTimeout(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      console.log(`📥 [HTTP ${response.status}] ${url}`);
      return await this.procesarRespuesta(response);
    } catch (err) {
      console.error(`💥 [HTTP ERROR PUT] ${url}:`, err);
      this.manejarErrorRed(err, url);
    }
  }

  async delete(endpoint) {
    const url = this.buildUrl(endpoint);
    console.log(`🌐 [HTTP DELETE] ${url}`);
    try {
      const response = await this.fetchConTimeout(url, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      console.log(`📥 [HTTP ${response.status}] ${url}`);
      return await this.procesarRespuesta(response);
    } catch (err) {
      console.error(`💥 [HTTP ERROR DELETE] ${url}:`, err);
      this.manejarErrorRed(err, url);
    }
  }

  async procesarRespuesta(response) {
    if (response.status === 401) {
      // Token inválido o expirado: cerrar sesión y redirigir al login
      console.warn('[ApiService] 401 Unauthorized — cerrando sesión.');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      const loginEl = document.getElementById('pantalla-login');
      const navEnc = document.getElementById('barra-navegacion');
      const navAdm = document.getElementById('barra-navegacion-admin');
      if (loginEl) loginEl.style.display = 'flex';
      if (navEnc) navEnc.style.display = 'none';
      if (navAdm) navAdm.style.display = 'none';
      document.querySelectorAll('.vista-pagina').forEach(v => v.classList.remove('activa'));
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    if (response.status === 403) {
      // Autenticado pero sin permisos: NO cerrar sesión
      console.warn('[ApiService] 403 Forbidden — sin permisos para esta acción.');
      throw new Error('No tienes permisos para realizar esta acción.');
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const mensaje = errorData.message || `Error HTTP ${response.status}: ${response.statusText}`;
      throw new Error(mensaje);
    }
    return await response.json();
  }

  manejarErrorRed(err, url) {
    if (err.name === 'AbortError') {
      throw new Error(
        `El servidor (${url}) tardó demasiado en responder y se canceló la petición. ` +
        `Puede ser tu conexión a Internet o que el servidor esté saturado/caído. Intenta de nuevo.`
      );
    }
    if (err.name === 'TypeError' || (err.message || '').includes('Failed to fetch')) {
      throw new Error(
        `No se pudo conectar al servidor backend (${url}).\n` +
        `Verifica que el backend local ('npm run start:dev') y el túnel de ngrok estén activos y accesibles.`
      );
    }
    throw err;
  }
}

export const apiService = new ApiService();
