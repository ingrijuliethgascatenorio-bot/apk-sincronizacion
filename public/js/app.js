/**
 * CONTROLADOR PRINCIPAL DEL FRONTEND NATIVO (JS ES6 MODULAR)
 * Coordina la interfaz, la navegación por pestañas, modales y eventos.
 */

import { sqliteService } from './sqlite.service.js';
import { authService } from './auth.service.js';
import { personasService } from './personas.service.js';
import { syncService } from './sync.service.js';
import { historialService } from './historial.service.js';
import { reportesService } from './reportes.service.js';

// Mapas de catálogos para renderizado visual
const MAPA_EPS = {
  1: 'Sura EPS',
  2: 'Sanitas EPS',
  3: 'Nueva EPS',
  4: 'Salud Total',
  5: 'Savia Salud',
  99: 'Otra EPS'
};

const MAPA_TIPO_DOC = {
  1: 'CC',
  2: 'TI',
  3: 'CE',
  4: 'PP',
  5: 'RC'
};

class AppController {
  constructor() {
    this.tabActual = 'inicio';
    this.filtroSyncActual = 'todos';
    this.terminoBusquedaActual = '';
  }

  /**
   * Inicialización global de la aplicación
   */
  async iniciar() {
    console.log('🚀 Iniciando SGES Frontend Nativo Modular...');

    try {
      // 1. Inicializar base de datos SQLite
      await sqliteService.inicializar();
    } catch (e) {
      console.warn('⚠️ SQLite inicializando en modo navegador web fallback:', e);
    }

    // 2. Comprobar sesión
    if (authService.estaAutenticado()) {
      this.ocultarLogin();
      await this.cargarDashboard();
    } else {
      this.mostrarLogin();
    }
  }

  mostrarLogin() {
    document.getElementById('pantalla-login').style.display = 'flex';
  }

  ocultarLogin() {
    document.getElementById('pantalla-login').style.display = 'none';
  }

  /**
   * Manejador de Login
   */
  async iniciarSesion(event) {
    event.preventDefault();
    const usrInput = document.getElementById('login-usuario').value.trim();
    const pwdInput = document.getElementById('login-password').value.trim();
    const errDiv = document.getElementById('login-error');

    errDiv.style.display = 'none';
    errDiv.textContent = '';

    try {
      const res = await authService.login(usrInput, pwdInput);
      if (res.exito) {
        this.ocultarLogin();
        await this.cargarDashboard();
        this.irA('inicio');
      } else {
        errDiv.textContent = res.mensaje;
        errDiv.style.display = 'block';
        alert(`❌ No se pudo ingresar: ${res.mensaje}`);
      }
    } catch (err) {
      console.error('Error de login:', err);
      const msg = err.message || 'Error de conexión con el servidor.';
      errDiv.textContent = msg;
      errDiv.style.display = 'block';
      alert(`❌ Error de red / conexión: ${msg}`);
    }
  }

  /**
   * Manejador de Cierre de Sesión
   */
  cerrarSesion() {
    if (confirm('¿Está seguro de que desea cerrar la sesión actual?')) {
      authService.logout();
      this.mostrarLogin();
    }
  }

  /**
   * Navegación entre Pestañas (Tabs)
   */
  async irA(nombreTab, opciones = {}) {
    this.tabActual = nombreTab;

    // Cambiar clase activa en botones de la barra inferior
    document.querySelectorAll('.boton-tab').forEach(btn => {
      if (btn.dataset.tab === nombreTab) {
        btn.classList.add('activo');
      } else {
        btn.classList.remove('activo');
      }
    });

    // Cambiar sección activa
    document.querySelectorAll('.vista-pagina').forEach(sec => {
      sec.classList.remove('activa');
    });

    const targetSec = document.getElementById(`vista-${nombreTab}`);
    if (targetSec) {
      targetSec.classList.add('activa');
    }

    // Cargar contenido específico de cada pestaña
    if (nombreTab === 'inicio') {
      await this.cargarDashboard();
    } else if (nombreTab === 'personas') {
      await this.cargarPersonas();
      if (opciones.accion === 'nuevo') {
        this.abrirModalNuevo();
      }
    } else if (nombreTab === 'sincronizar') {
      await this.cargarSincronizar();
    } else if (nombreTab === 'historial') {
      await this.cargarHistorial();
    } else if (nombreTab === 'reportes') {
      await this.cargarReportes();
    } else if (nombreTab === 'perfil') {
      this.cargarPerfil();
    }
  }

  /**
   * Carga métricas y estado del Dashboard (Inicio)
   */
  async cargarDashboard() {
    const usuario = authService.obtenerUsuarioActual();
    document.getElementById('inicio-saludo').textContent = `Hola, ${usuario} 👋`;
    
    const hoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    document.getElementById('inicio-fecha').textContent = `📅 ${hoy}`;

    // Cargar Métricas
    const metricas = await personasService.obtenerMetricas();
    document.getElementById('metric-total').textContent = metricas.total;
    document.getElementById('metric-synced').textContent = metricas.synced;
    document.getElementById('metric-pending').textContent = metricas.pending;
    document.getElementById('metric-errors').textContent = metricas.errors;

    // Banner Sync
    const ultSync = await syncService.obtenerUltimaSync();
    const banner = document.getElementById('banner-sync');
    const txtBanner = document.getElementById('txt-banner-sync');

    if (ultSync) {
      const fecha = new Date(ultSync.fecha_fin);
      txtBanner.textContent = `Última sincronización: ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · ${ultSync.cantidad_registros} registros`;
      banner.className = 'banner-estado success';
    } else {
      txtBanner.textContent = 'Aún no se ha sincronizado en este dispositivo';
      banner.className = 'banner-estado alerta';
    }
  }

  /**
   * Carga la lista de Personas
   */
  async cargarPersonas() {
    const lista = await personasService.obtenerTodas(
      this.terminoBusquedaActual,
      this.filtroSyncActual,
      'todos'
    );

    document.getElementById('personas-conteo').textContent = `${lista.length} persona${lista.length === 1 ? '' : 's'} encontrada${lista.length === 1 ? '' : 's'}`;

    const contenedor = document.getElementById('lista-personas-contenedor');
    contenedor.innerHTML = '';

    if (lista.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: var(--color-text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
          <p>No se encontraron personas con los filtros seleccionados.</p>
        </div>
      `;
      return;
    }

    lista.forEach(p => {
      const iniciales = (p.nombres.charAt(0) + (p.apellidos.charAt(0) || '')).toUpperCase();
      const tipoDocText = MAPA_TIPO_DOC[p.id_tipo_documento] || 'DOC';
      const epsText = MAPA_EPS[p.id_eps] || 'EPS';

      let claseBadge = 'pendiente';
      let textBadge = 'Pendiente';
      if (p.estado_sincronizacion === 'SYNCED') {
        claseBadge = 'sincronizado';
        textBadge = 'Sincronizado';
      } else if (p.estado_sincronizacion === 'ERROR') {
        claseBadge = 'error';
        textBadge = 'Error';
      }

      if (p.estado_registro === 'INACTIVO') {
        claseBadge = 'inactivo';
        textBadge = 'Inactivo';
      }

      const item = document.createElement('div');
      item.className = 'tarjeta-persona';
      item.onclick = () => this.abrirModalEditar(p.id);
      item.innerHTML = `
        <div class="avatar-persona">${iniciales}</div>
        <div class="persona-info">
          <div class="persona-nombre">${p.nombres} ${p.apellidos}</div>
          <div class="persona-sub">${tipoDocText} ${p.numero_documento} · ${epsText}</div>
        </div>
        <span class="insignia ${claseBadge}">${textBadge}</span>
      `;
      contenedor.appendChild(item);
    });
  }

  onBuscarInput(event) {
    this.terminoBusquedaActual = event.target.value;
    this.cargarPersonas();
  }

  setFiltroSync(filtro, elementoBoton) {
    this.filtroSyncActual = filtro;
    document.querySelectorAll('.contenedor-filtros .boton-filtro').forEach(btn => btn.classList.remove('activo'));
    if (elementoBoton) elementoBoton.classList.add('activo');
    this.cargarPersonas();
  }

  /**
   * Manejadores del Formulario Único Modal (Registrar / Consultar / Editar)
   */
  abrirModalNuevo() {
    document.getElementById('modal-persona-titulo').textContent = 'Registrar Nueva Persona';
    document.getElementById('form-persona').reset();
    document.getElementById('persona-id').value = '';
    document.getElementById('btn-inactivar-persona').style.display = 'none';
    document.getElementById('modal-persona').classList.add('activo');
  }

  async abrirModalEditar(idPersona) {
    const p = await personasService.obtenerPorId(idPersona);
    if (!p) return;

    document.getElementById('modal-persona-titulo').textContent = 'Consultar / Editar Persona';
    document.getElementById('persona-id').value = p.id;
    document.getElementById('persona-nombres').value = p.nombres;
    document.getElementById('persona-apellidos').value = p.apellidos;
    document.getElementById('persona-tipo-doc').value = p.id_tipo_documento;
    document.getElementById('persona-numero-doc').value = p.numero_documento;
    document.getElementById('persona-fecha-nac').value = p.fecha_nacimiento;
    document.getElementById('persona-genero').value = p.genero;
    document.getElementById('persona-eps').value = p.id_eps;
    document.getElementById('persona-telefono').value = p.telefono || '';
    document.getElementById('persona-barrio').value = p.barrio || '';
    document.getElementById('persona-direccion').value = p.direccion || '';

    if (p.estado_registro === 'ACTIVO') {
      document.getElementById('btn-inactivar-persona').style.display = 'block';
    } else {
      document.getElementById('btn-inactivar-persona').style.display = 'none';
    }

    document.getElementById('modal-persona').classList.add('activo');
  }

  cerrarModal() {
    document.getElementById('modal-persona').classList.remove('activo');
  }

  async guardarFormulario(event) {
    event.preventDefault();
    const pId = document.getElementById('persona-id').value;

    const datos = {
      id: pId ? Number(pId) : null,
      nombres: document.getElementById('persona-nombres').value.trim(),
      apellidos: document.getElementById('persona-apellidos').value.trim(),
      id_tipo_documento: Number(document.getElementById('persona-tipo-doc').value),
      numero_documento: document.getElementById('persona-numero-doc').value.trim(),
      fecha_nacimiento: document.getElementById('persona-fecha-nac').value,
      genero: document.getElementById('persona-genero').value,
      id_eps: Number(document.getElementById('persona-eps').value),
      telefono: document.getElementById('persona-telefono').value.trim(),
      barrio: document.getElementById('persona-barrio').value.trim(),
      direccion: document.getElementById('persona-direccion').value.trim()
    };

    try {
      await personasService.guardar(datos);
      this.cerrarModal();
      alert('✅ Registro guardado correctamente en SQLite local.');
      await this.cargarPersonas();
      await this.cargarDashboard();
    } catch (e) {
      alert(`❌ Error al guardar en SQLite: ${e.message}`);
    }
  }

  async inactivarPersonaActual() {
    const pId = document.getElementById('persona-id').value;
    if (!pId) return;

    if (confirm('¿Está seguro de inactivar esta persona?')) {
      await personasService.inactivar(Number(pId));
      this.cerrarModal();
      alert('Registro inactivado correctamente.');
      await this.cargarPersonas();
      await this.cargarDashboard();
    }
  }

  /**
   * Carga la vista de Sincronización
   */
  async cargarSincronizar() {
    const pendientes = await syncService.obtenerPendientes();
    document.getElementById('sync-pendientes-titulo').textContent = `${pendientes.length} Registro${pendientes.length === 1 ? '' : 's'} Pendiente${pendientes.length === 1 ? '' : 's'}`;

    const contenedor = document.getElementById('lista-sync-pendientes');
    contenedor.innerHTML = '';

    if (pendientes.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--color-text-muted);">
          <p>✅ Todos los registros locales están sincronizados con PostgreSQL.</p>
        </div>
      `;
      return;
    }

    pendientes.forEach(p => {
      const div = document.createElement('div');
      div.className = 'tarjeta-persona';
      div.innerHTML = `
        <div>
          <div class="persona-nombre">${p.nombres} ${p.apellidos}</div>
          <div class="persona-sub">Doc: ${p.numero_documento}</div>
        </div>
        <span class="insignia pendiente">${p.estado_sincronizacion}</span>
      `;
      contenedor.appendChild(div);
    });
  }

  async ejecutarSincronizacionManual() {
    try {
      const res = await syncService.sincronizar();
      alert(`✅ ${res.mensaje}`);
      await this.cargarSincronizar();
      await this.cargarDashboard();
    } catch (e) {
      alert(`❌ Error al sincronizar con el servidor: ${e.message}`);
    }
  }

  /**
   * Carga la vista de Historial
   */
  async cargarHistorial() {
    const logs = await historialService.obtenerHistorial();
    const contenedor = document.getElementById('lista-historial-contenedor');
    contenedor.innerHTML = '';

    if (logs.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--color-text-muted);">
          <p>No hay registros de sincronización recientes.</p>
        </div>
      `;
      return;
    }

    logs.forEach(log => {
      const fecha = new Date(log.fecha_fin).toLocaleString('es-CO');
      const div = document.createElement('div');
      div.className = 'tarjeta-blanca';
      div.style.marginBottom = '10px';
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 0.95rem;">${fecha}</strong>
          <span class="insignia ${log.estado === 'ÉXITO' ? 'sincronizado' : 'error'}">${log.estado}</span>
        </div>
        <p style="color: var(--color-text-muted); font-size: 0.85rem; margin-top: 6px;">
          ${log.mensaje} (${log.cantidad_registros} registros)
        </p>
      `;
      contenedor.appendChild(div);
    });
  }

  /**
   * Carga la vista de Reportes
   */
  async cargarReportes() {
    const rep = await reportesService.obtenerReporteGeneral();
    const contenedor = document.getElementById('reporte-distribucion');
    contenedor.innerHTML = `
      <div style="padding: 10px 0;">
        <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Total personas registradas en SQLite:</span>
          <strong>${rep.total}</strong>
        </div>
        <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Registros Activos:</span>
          <strong style="color: var(--color-success);">${rep.activos}</strong>
        </div>
        <div style="display:flex; justify-content: space-between;">
          <span>Registros Inactivos:</span>
          <strong style="color: var(--color-danger);">${rep.inactivos}</strong>
        </div>
      </div>
    `;
  }

  /**
   * Carga la vista de Perfil
   */
  cargarPerfil() {
    const usr = authService.obtenerUsuarioActual();
    document.getElementById('perfil-nombre').textContent = usr;
    document.getElementById('perfil-avatar').textContent = usr.slice(0, 2).toUpperCase();
  }
}

// Instancia global
const app = new AppController();

// Exponer a la ventana global para invocación desde HTML
window.appAuth = {
  iniciarSesion: (e) => app.iniciarSesion(e),
  cerrarSesion: () => app.cerrarSesion()
};

window.appNavegacion = {
  irA: (tab, opts) => app.irA(tab, opts)
};

window.appPersonas = {
  abrirModalNuevo: () => app.abrirModalNuevo(),
  cerrarModal: () => app.cerrarModal(),
  guardarFormulario: (e) => app.guardarFormulario(e),
  inactivarPersonaActual: () => app.inactivarPersonaActual(),
  onBuscarInput: (e) => app.onBuscarInput(e),
  setFiltroSync: (f, el) => app.setFiltroSync(f, el)
};

window.appSync = {
  ejecutarSincronizacionManual: () => app.ejecutarSincronizacionManual()
};

// Auto-iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  app.iniciar();
});
