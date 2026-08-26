/**
 * SERVICIO AUTENTICACIÓN (JS ES6)
 * Gestiona el inicio de sesión, el token JWT y el estado de la sesión activa
 */

import { apiService } from './api.service.js';

class AuthService {
  constructor() {
    this.tokenKey = 'auth_token';
    this.userKey = 'auth_user';
  }

  /**
   * Realiza la solicitud de login al backend NestJS (/api/auth/login)
   */
  async login(username, password) {
    try {
      const data = await apiService.post('/auth/login', { username, password });
      if (data && data.access_token) {
        localStorage.setItem(this.tokenKey, data.access_token);
        localStorage.setItem(this.userKey, username);
        return { exito: true, usuario: username };
      }
      throw new Error('Respuesta inválida del servidor.');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      return { exito: false, mensaje: error.message || 'Usuario o contraseña incorrectos.' };
    }
  }

  /**
   * Elimina la sesión activa
   */
  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * Retorna true si hay un token almacenado
   */
  estaAutenticado() {
    return !!localStorage.getItem(this.tokenKey);
  }

  /**
   * Obtiene el nombre del usuario logueado
   */
  obtenerUsuarioActual() {
    return localStorage.getItem(this.userKey) || 'Usuario';
  }

  obtenerPayload() {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Error al decodificar token:', e);
      return null;
    }
  }

  obtenerRolActual() {
    const payload = this.obtenerPayload();
    return payload?.rol || 'ENCUESTADOR';
  }

  obtenerNombreCompleto() {
    const payload = this.obtenerPayload();
    if (payload?.nombre || payload?.apellido) {
      return `${payload.nombre || ''} ${payload.apellido || ''}`.trim();
    }
    return localStorage.getItem(this.userKey) || 'Administrador';
  }

  /**
   * SESIÓN DESLIZANTE
   * -----------------
   * El token dura varias horas (ver JWT_EXPIRES_IN en el backend), pero si
   * el encuestador está usando la app activamente durante una jornada larga
   * no queremos que lo saque a mitad de una encuesta. Por eso, cuando falta
   * poco para que expire, pedimos uno nuevo en segundo plano usando
   * POST /auth/refresh (válido mientras el token actual NO haya expirado
   * todavía). Si de verdad pasó más tiempo del que dura el token sin usar
   * la app, esto fallará con 401 y el usuario tendrá que loguearse de
   * nuevo — eso es correcto y esperado.
   */
  segundosParaExpirar() {
    const payload = this.obtenerPayload();
    if (!payload?.exp) return null;
    return payload.exp - Math.floor(Date.now() / 1000);
  }

  /**
   * Refresca el token si está a menos de `margenSegundos` de expirar.
   * No hace nada (ni llama a la red) si el token todavía tiene tiempo de
   * sobra, para no gastar peticiones innecesarias.
   */
  async refrescarSiNecesario(margenSegundos = 30 * 60) {
    if (!this.estaAutenticado()) return;

    const restante = this.segundosParaExpirar();
    // null = no se pudo leer el token (corrupto); negativo o bajo = ya
    // expiró o está por expirar. En ambos casos NO intentamos refrescar
    // uno que probablemente ya no sirve; dejamos que la próxima llamada
    // real reciba el 401 y se maneje como corresponde (logout + login).
    if (restante === null || restante <= 0) return;
    if (restante > margenSegundos) return;

    try {
      const data = await apiService.post('/auth/refresh', {});
      if (data && data.access_token) {
        localStorage.setItem(this.tokenKey, data.access_token);
        console.log('🔄 [AuthService] Sesión renovada automáticamente (sesión deslizante).');
      }
    } catch (e) {
      // Si falla (ya expiró, sin red, etc.) no hacemos nada especial aquí:
      // la próxima petición real disparará el manejo normal de 401.
      console.warn('⚠️ [AuthService] No se pudo renovar el token automáticamente:', e.message);
    }
  }
}

export const authService = new AuthService();
