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
    return localStorage.getItem(this.userKey) || 'encuestador1';
  }
}

export const authService = new AuthService();
