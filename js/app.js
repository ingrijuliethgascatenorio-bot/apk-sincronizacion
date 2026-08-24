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
import { adminController } from './admin.js';

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
      await this.cargarInterfazSegunRol();
    } else {
      this.mostrarLogin();
    }
  }

  async cargarInterfazSegunRol() {
    const rol = authService.obtenerRolActual();
    const navEncuestador = document.getElementById('barra-navegacion');
    const navAdmin = document.getElementById('barra-navegacion-admin');

    if (rol === 'ADMIN') {
      if (navEncuestador) navEncuestador.style.display = 'none';
      if (navAdmin) navAdmin.style.display = 'flex';
      await this.irA('admin-inicio');
    } else {
      if (navAdmin) navAdmin.style.display = 'none';
      if (navEncuestador) navEncuestador.style.display = 'flex';
      await this.irA('inicio');
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
        await this.cargarInterfazSegunRol();
      } else {
        errDiv.textContent = res.mensaje;
        errDiv.style.display = 'block';
      }
    } catch (err) {
      console.error('Error de login:', err);
      const msg = err.message || 'Error de conexión con el servidor.';
      errDiv.textContent = msg;
      errDiv.style.display = 'block';
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
    // Protección y validación de seguridad de roles en el frontend
    const rol = authService.obtenerRolActual();
    const esVistaAdmin = nombreTab.startsWith('admin-');

    if (rol === 'ENCUESTADOR' && esVistaAdmin) {
      console.warn(`[Security Alert] ENCUESTADOR intentando acceder a vista administrativa: ${nombreTab}. Redirigiendo a inicio.`);
      this.tabActual = 'inicio';
      nombreTab = 'inicio';
    } else if (rol === 'ADMIN' && !esVistaAdmin && nombreTab !== 'perfil') {
      // Redirigir administradores que intenten ir a vistas del encuestador
      console.warn(`[Security Alert] ADMIN intentando acceder a vista de encuestador: ${nombreTab}. Redirigiendo a admin-inicio.`);
      this.tabActual = 'admin-inicio';
      nombreTab = 'admin-inicio';
    } else {
      this.tabActual = nombreTab;
    }

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
    } else if (nombreTab === 'admin-inicio') {
      await adminController.cargarAdminDashboard();
    } else if (nombreTab === 'admin-inconsistencias') {
      await adminController.cargarAdminInconsistencias();
    } else if (nombreTab === 'admin-auditoria') {
      await adminController.cargarAdminAuditoria();
    } else if (nombreTab === 'admin-reportes') {
      await adminController.cargarAdminReportes();
    } else if (nombreTab === 'admin-perfil') {
      adminController.cargarAdminPerfil();
    }
  }

  /**
   * Carga métricas y estado del Dashboard (Inicio)
   */
  async cargarDashboard() {
    const usuario = authService.obtenerUsuarioActual();
    document.getElementById('inicio-saludo').textContent = `Hola, ${usuario}`;
    
    const hoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    document.getElementById('inicio-fecha').textContent = hoy;

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
        <div class="estado-vacio">
          <div class="estado-vacio-icono"><ion-icon name="search-outline"></ion-icon></div>
          <div class="estado-vacio-titulo">No se encontraron personas</div>
          <div class="estado-vacio-desc">No hay registros que coincidan con el término o filtro seleccionado.</div>
        </div>
      `;
      return;
    }

    lista.forEach(p => {
      const iniciales = (p.nombres.charAt(0) + (p.apellidos.charAt(0) || '')).toUpperCase();
      const tipoDocText = MAPA_TIPO_DOC[p.id_tipo_documento] || 'DOC';
      const epsText = Number(p.id_eps) === 99 ? (p.eps_otro_nombre || 'Otra EPS') : (MAPA_EPS[p.id_eps] || 'EPS');

      let claseBadge = 'pendiente';
      let textBadge = 'Pendiente de sincronización';
      if (p.estado_sincronizacion === 'SYNCED') {
        claseBadge = 'sincronizado';
        textBadge = 'Sincronizado';
      } else if (p.estado_sincronizacion === 'ERROR') {
        claseBadge = 'error';
        textBadge = 'Error de sincronización';
      } else if (['INCONSISTENCIA', 'CONFLICTO', 'CONFLICT'].includes(p.estado_sincronizacion)) {
        claseBadge = 'pendiente';
        textBadge = 'Inconsistencia';
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
    document.getElementById('campo-eps-otro').style.display = 'none';
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
    document.getElementById('persona-telefono').value = p.telefono1 || '';
    document.getElementById('persona-correo').value = p.correo || '';
    document.getElementById('persona-estrato').value = p.estrato || '';
    document.getElementById('persona-estado-civil').value = p.estado_civil || '';
    document.getElementById('persona-barrio').value = p.barrio || '';
    document.getElementById('persona-direccion').value = p.direccion || '';
    document.getElementById('persona-eps-otro').value = p.eps_otro_nombre || '';
    this.actualizarVisibilidadEpsOtro(document.getElementById('persona-eps'));

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

  onCambioEps(selectEl) {
    this.actualizarVisibilidadEpsOtro(selectEl);
  }

  actualizarVisibilidadEpsOtro(selectEl) {
    const campoOtro = document.getElementById('campo-eps-otro');
    const inputOtro = document.getElementById('persona-eps-otro');
    if (Number(selectEl.value) === 99) {
      campoOtro.style.display = 'block';
      inputOtro.required = true;
    } else {
      campoOtro.style.display = 'none';
      inputOtro.required = false;
      inputOtro.value = '';
    }
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
      eps_otro_nombre: document.getElementById('persona-eps-otro').value.trim(),
      telefono1: document.getElementById('persona-telefono').value.trim(),
      correo: document.getElementById('persona-correo').value.trim(),
      estrato: document.getElementById('persona-estrato').value,
      estado_civil: document.getElementById('persona-estado-civil').value,
      barrio: document.getElementById('persona-barrio').value.trim(),
      direccion: document.getElementById('persona-direccion').value.trim()
    };

    try {
      await personasService.guardar(datos);
      this.cerrarModal();
      alert('Registro guardado correctamente en SQLite local.');
      await this.cargarPersonas();
      await this.cargarDashboard();
    } catch (e) {
      alert(`Error al guardar en SQLite: ${e.message}`);
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
        <div class="estado-vacio">
          <div class="estado-vacio-icono exito"><ion-icon name="cloud-done-outline"></ion-icon></div>
          <div class="estado-vacio-titulo">Todo está sincronizado</div>
          <div class="estado-vacio-desc">Todos los registros locales están sincronizados con PostgreSQL central.</div>
        </div>
      `;
      return;
    }

    pendientes.forEach(p => {
      let claseBadge = 'pendiente';
      let textBadge = 'Pendiente de sincronización';
      if (p.estado_sincronizacion === 'ERROR') {
        claseBadge = 'error';
        textBadge = 'Error de sincronización';
      } else if (['INCONSISTENCIA', 'CONFLICTO', 'CONFLICT'].includes(p.estado_sincronizacion)) {
        claseBadge = 'pendiente';
        textBadge = 'Inconsistencia';
      } else if (p.estado_sincronizacion === 'SYNCED') {
        claseBadge = 'sincronizado';
        textBadge = 'Sincronizado';
      }

      const div = document.createElement('div');
      div.className = 'tarjeta-persona';
      div.innerHTML = `
        <div>
          <div class="persona-nombre">${p.nombres} ${p.apellidos}</div>
          <div class="persona-sub">Doc: ${p.numero_documento}</div>
        </div>
        <span class="insignia ${claseBadge}">${textBadge}</span>
      `;
      contenedor.appendChild(div);
    });
  }

  async ejecutarSincronizacionManual() {
    try {
      const res = await syncService.sincronizar();
      alert(res.mensaje);
      await this.cargarSincronizar();
      await this.cargarDashboard();
    } catch (e) {
      alert(`Error al sincronizar con el servidor: ${e.message}`);
    }
  }

  setFiltroHistorial(filtro, elementoBoton) {
    this.filtroHistorialActual = filtro;
    document.querySelectorAll('#vista-historial .contenedor-filtros .boton-filtro').forEach(btn => btn.classList.remove('activo'));
    if (elementoBoton) elementoBoton.classList.add('activo');
    this.cargarHistorial();
  }

  /**
   * Carga la vista de Historial (Agrupando con contadores visuales y estados claros)
   */
  async cargarHistorial() {
    let logs = await historialService.obtenerHistorial();
    const contenedor = document.getElementById('lista-historial-contenedor');
    contenedor.innerHTML = '';

    const filtro = this.filtroHistorialActual || 'todos';
    if (filtro === 'completados') {
      logs = logs.filter(l => l.estado === 'ÉXITO' || l.estado === 'COMPLETADO');
    } else if (filtro === 'errores') {
      logs = logs.filter(l => l.estado === 'ERROR');
    }

    if (logs.length === 0) {
      contenedor.innerHTML = `
        <div class="estado-vacio">
          <div class="estado-vacio-icono"><ion-icon name="time-outline"></ion-icon></div>
          <div class="estado-vacio-titulo">No hay registros de historial</div>
          <div class="estado-vacio-desc">Los eventos y lotes de sincronización aparecerán aquí.</div>
        </div>
      `;
      return;
    }

    // Algoritmo de agrupación visual para sincronizaciones consecutivas / intentos
    const agrupados = [];
    let actualGroup = null;

    logs.forEach(log => {
      if (log.estado === 'ERROR') {
        if (actualGroup && actualGroup.estado === 'ERROR') {
          actualGroup.intentos = (actualGroup.intentos || 1) + 1;
          actualGroup.mensaje = log.mensaje;
          actualGroup.cantidad_registros += (log.cantidad_registros || 0);
        } else {
          actualGroup = { ...log, intentos: 1 };
          agrupados.push(actualGroup);
        }
      } else {
        actualGroup = { ...log, intentos: 1 };
        agrupados.push(actualGroup);
      }
    });

    agrupados.forEach((log, index) => {
      const fecha = new Date(log.fecha_fin || log.fecha_inicio).toLocaleString('es-CO');
      const div = document.createElement('div');
      div.className = 'tarjeta-blanca';
      div.style.marginBottom = '12px';
      div.style.padding = '16px';

      const esExito = log.estado === 'ÉXITO' || log.estado === 'COMPLETADO';
      const badgeClase = esExito ? 'sincronizado' : 'error';
      const badgeText = !esExito && log.intentos > 1 
        ? `ERROR (${log.intentos} intentos)` 
        : (log.estado || 'REGISTRADO');

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <ion-icon name="${esExito ? 'cloud-done' : 'alert-circle'}" style="font-size: 20px; color: var(--color-${esExito ? 'success' : 'danger'});"></ion-icon>
            <strong style="font-size: 0.95rem; color: var(--color-text);">Sincronización #${logs.length - index}</strong>
          </div>
          <span class="insignia ${badgeClase}">${badgeText}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.5;">
          <div style="display: flex; gap: 12px; margin-bottom: 6px;">
            <span style="color: var(--color-success); font-weight: 600;">✓ ${log.cantidad_registros || 0} procesados</span>
            ${!esExito ? `<span style="color: var(--color-danger); font-weight: 600;">⚠ Con incidencias</span>` : ''}
          </div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          <div style="margin-top: 4px; font-size: 0.8rem; color: var(--color-text-muted);">${log.mensaje || 'Sincronización procesada.'}</div>
        </div>
      `;
      contenedor.appendChild(div);
    });
  }

  /**
   * Carga la vista de Reportes
   */
  async cargarReportes() {
    // Inicializar el controlador de reportes de sincronización del encuestador
    await appReportes.cargarReportes();
  }

  /**
   * Carga la vista de Perfil
   */
  cargarPerfil() {
    const payload = authService.obtenerPayload();
    const usr = authService.obtenerUsuarioActual();
    const nombreCompleto = authService.obtenerNombreCompleto();
    const rol = authService.obtenerRolActual();

    document.getElementById('perfil-nombre').textContent = nombreCompleto;
    document.getElementById('perfil-avatar').textContent = nombreCompleto.slice(0, 2).toUpperCase();

    // Actualizar elementos adicionales si existen en el index.html para dar visibilidad
    const subtituloPerfil = document.querySelector('#vista-perfil .tarjeta-blanca p');
    if (subtituloPerfil) {
      subtituloPerfil.innerHTML = `
        <strong>Usuario:</strong> ${usr}<br/>
        <strong>Rol asignado:</strong> <span class="insignia sincronizado" style="font-size: 0.75rem; margin-top: 4px; display: inline-block;">${rol}</span>
      `;
    }

    // Inicializar selects de tema en perfil
    const temaActual = localStorage.getItem('theme_preference') || 'light';
    const select = document.getElementById('perfil-select-tema');
    if (select) select.value = temaActual;
  }
}

class TemaController {
  constructor() {
    this.temaActual = localStorage.getItem('theme_preference') || 'light';
    this.aplicarTema(this.temaActual);
  }

  cambiarTema(tema) {
    this.temaActual = tema;
    localStorage.setItem('theme_preference', tema);
    this.aplicarTema(tema);
  }

  aplicarTema(tema) {
    if (tema === 'dark') {
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
    }
    // Sincronizar selectores si existen en el DOM
    const adminSelect = document.getElementById('admin-select-tema');
    const userSelect = document.getElementById('perfil-select-tema');
    if (adminSelect) adminSelect.value = tema;
    if (userSelect) userSelect.value = tema;
  }
}

class EncuestadorReportesController {
  constructor() {
    this.paginaReportes = 1;
    this.filtroFecha = '';
    this.terminoBusqueda = '';
  }

  async cargarReportes() {
    const contenedor = document.getElementById('lista-reportes-sincronizaciones');
    if (!contenedor) return;

    contenedor.innerHTML = '<div style="text-align: center; padding: 12px; color: var(--color-text-muted);">Cargando tus reportes...</div>';

    try {
      const response = await reportesService.listarSincronizaciones(this.paginaReportes, 10);
      contenedor.innerHTML = '';

      let lista = response.datos || [];

      // Aplicar filtros locales de búsqueda
      if (this.terminoBusqueda) {
        lista = lista.filter(item => 
          String(item.id).includes(this.terminoBusqueda) || 
          (item.nombre_usuario || '').toLowerCase().includes(this.terminoBusqueda.toLowerCase())
        );
      }

      if (this.filtroFecha) {
        lista = lista.filter(item => {
          const itemFecha = new Date(item.fecha_inicio).toISOString().split('T')[0];
          return itemFecha === this.filtroFecha;
        });
      }

      if (lista.length === 0) {
        contenedor.innerHTML = `
          <div class="estado-vacio">
            <div class="estado-vacio-icono"><ion-icon name="bar-chart-outline"></ion-icon></div>
            <div class="estado-vacio-titulo">Sin sincronizaciones encontradas</div>
            <div class="estado-vacio-desc">No hay lotes de sincronización para los filtros de búsqueda seleccionados.</div>
          </div>
        `;
        renderizarPaginador(0, 10, 1, 'paginacion-reportes-sync', () => {});
        return;
      }

      lista.forEach(s => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-blanca';
        tarjeta.style.marginBottom = '12px';
        tarjeta.style.padding = '14px';
        tarjeta.style.cursor = 'pointer';
        tarjeta.onclick = () => this.abrirDetalle(s.id);

        const fechaStr = new Date(s.fecha_inicio).toLocaleString('es-CO');
        const estadoClass = s.estado === 'COMPLETADO' ? 'sincronizado' : 'error';

        tarjeta.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 6px; margin-bottom: 8px;">
            <strong style="color: var(--color-primary);">Sincronización #${s.id}</strong>
            <span class="insignia ${estadoClass}">${s.estado}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--color-text-muted);">
            <div><strong>Fecha:</strong> ${fechaStr}</div>
            <div style="margin-top: 4px; font-weight: 600; color: var(--color-text);">
              Nuevos: ${s.registros_nuevos} · Actualizados: ${s.registros_actualizados} · Errores: ${s.registros_error}
            </div>
          </div>
        `;
        contenedor.appendChild(tarjeta);
      });

      renderizarPaginador(response.total || 0, 10, this.paginaReportes, 'paginacion-reportes-sync', (nuevaPag) => {
        this.paginaReportes = nuevaPag;
        this.cargarReportes();
      });

    } catch (e) {
      console.error('Error al listar reportes en encuestador:', e);
      contenedor.innerHTML = '<div style="text-align: center; padding: 12px; color: var(--color-danger);">Error de conexión.</div>';
    }
  }

  onBuscarInput(event) {
    this.terminoBusqueda = event.target.value.trim();
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  onCambiarFecha(event) {
    this.filtroFecha = event.target.value;
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  limpiarFiltros() {
    document.getElementById('reportes-input-busqueda').value = '';
    document.getElementById('reportes-filtro-fecha').value = '';
    this.terminoBusqueda = '';
    this.filtroFecha = '';
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  async abrirDetalle(id) {
    const listSec = document.getElementById('reporte-general-seccion');
    const detSec = document.getElementById('reporte-detalle-seccion');
    const detCont = document.getElementById('reporte-detalle-contenido');

    listSec.style.display = 'none';
    detSec.style.display = 'block';
    detCont.innerHTML = '<div style="text-align: center; padding: 12px;">Cargando detalles de sincronización...</div>';

    try {
      const data = await reportesService.obtenerDetalleSincronizacion(id);
      const s = data.sincronizacion;
      const cambios = data.cambios || [];

      let cambiosHtml = '';
      if (cambios.length === 0) {
        cambiosHtml = '<p style="font-size: 0.9rem; color: var(--color-text-muted); font-style: italic;">Sin cambios registrados en esta sincronización.</p>';
      } else {
        cambios.forEach(c => {
          cambiosHtml += `
            <div class="tarjeta-persona" style="flex-direction: column; align-items: stretch; gap: 4px; padding: 10px; margin-bottom: 8px;">
              <div style="font-weight: 700; font-size: 0.9rem;">Documento: ${c.numero_documento}</div>
              <div style="font-size: 0.85rem; color: var(--color-text-muted);">
                Campo: <strong>${c.campo_modificado}</strong>
              </div>
              <div style="font-size: 0.85rem; color: var(--color-danger);">Antes: ${c.valor_anterior || '(vacío)'}</div>
              <div style="font-size: 0.85rem; color: var(--color-success);">Después: ${c.valor_nuevo || '(vacío)'}</div>
            </div>
          `;
        });
      }

      detCont.innerHTML = `
        <div class="tarjeta-blanca" style="padding: 16px; margin-bottom: 16px;">
          <h2 style="font-size: 1.25rem; font-weight: 800; color: var(--color-primary); margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 6px;">Sincronización #${s.id}</h2>
          <div style="font-size: 0.9rem; line-height: 1.5; color: var(--color-text-muted);">
            <div><strong>Fecha de inicio:</strong> ${new Date(s.fecha_inicio).toLocaleString('es-CO')}</div>
            <div><strong>Fecha de fin:</strong> ${s.fecha_fin ? new Date(s.fecha_fin).toLocaleString('es-CO') : 'N/A'}</div>
            <div><strong>Duración:</strong> ${s.duracion_ms ? (s.duracion_ms / 1000).toFixed(2) + 's' : 'N/A'}</div>
            <div><strong>Total registros procesados:</strong> ${s.cantidad_registros}</div>
            <div style="margin-top: 8px; font-weight: 700; color: var(--color-text);">
              Nuevos: ${s.registros_nuevos} · Actualizados: ${s.registros_actualizados} · Errores: ${s.registros_error}
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="boton-principal" style="flex: 1;" onclick="appReportes.descargarReporte(${s.id}, 'pdf')">
              <ion-icon name="download"></ion-icon> Descargar PDF
            </button>
            <button class="boton-secundario" style="flex: 1;" onclick="appReportes.descargarReporte(${s.id}, 'txt')">
              <ion-icon name="document-text"></ion-icon> Descargar TXT
            </button>
          </div>
        </div>
        <h3 style="font-size: 1rem; font-weight: 800; margin-bottom: 10px;">Detalle de Cambios</h3>
        <div style="max-height: 300px; overflow-y: auto;">
          ${cambiosHtml}
        </div>
      `;
    } catch (e) {
      console.error('Error al cargar detalle:', e);
      detCont.innerHTML = '<div style="text-align: center; color: var(--color-danger);">Error al cargar detalle.</div>';
    }
  }

  mostrarListaSincronizaciones() {
    document.getElementById('reporte-general-seccion').style.display = 'block';
    document.getElementById('reporte-detalle-seccion').style.display = 'none';
  }

  async descargarReporte(id, formato) {
    try {
      const blob = await reportesService.descargarReporteBlob(id, formato);
      const blobUrl = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `reporte_sync_${id}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      alert(`${formato.toUpperCase()} descargado.`);
    } catch (e) {
      alert(`Error al descargar el archivo: ${e.message}`);
    }
  }
}

export const appTema = new TemaController();
export const appReportes = new EncuestadorReportesController();

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
  setFiltroSync: (f, el) => app.setFiltroSync(f, el),
  onCambioEps: (selectEl) => app.onCambioEps(selectEl)
};

window.appSync = {
  ejecutarSincronizacionManual: () => app.ejecutarSincronizacionManual()
};

window.appHistorial = {
  setFiltroHistorial: (f, el) => app.setFiltroHistorial(f, el)
};

window.appAdmin = {
  cambiarFiltroConf: (est, btn) => adminController.cambiarFiltroConf(est, btn),
  abrirModalConflicto: (id) => adminController.abrirModalConflicto(id),
  cerrarModalConflicto: () => adminController.cerrarModalConflicto(),
  onCambioDecisionResolucion: (el) => adminController.onCambioDecisionResolucion(el),
  guardarResolucion: (e) => adminController.guardarResolucion(e),
  onBuscarInconsistencia: (e) => adminController.onBuscarInconsistencia(e),
  onBuscarAuditoria: (e) => adminController.onBuscarAuditoria(e),
  onCambiarFechaAuditoria: (e) => adminController.onCambiarFechaAuditoria(e),
  filtrarHoyAuditoria: () => adminController.filtrarHoyAuditoria(),
  limpiarFiltrosAuditoria: () => adminController.limpiarFiltrosAuditoria()
};

window.appTema = {
  cambiarTema: (tema) => appTema.cambiarTema(tema)
};

import { adminReportesController } from './admin.js';

window.appAdminReportes = {
  onBuscarInput: (e) => adminReportesController.onBuscarInput(e),
  onCambiarFecha: (e) => adminReportesController.onCambiarFecha(e),
  limpiarFiltros: () => adminReportesController.limpiarFiltros(),
  descargarReporte: (id, f) => adminReportesController.descargarReporte(id, f),
  mostrarListaSincronizaciones: () => adminReportesController.mostrarListaSincronizaciones()
};

window.appReportes = {
  onBuscarInput: (e) => appReportes.onBuscarInput(e),
  onCambiarFecha: (e) => appReportes.onCambiarFecha(e),
  limpiarFiltros: () => appReportes.limpiarFiltros(),
  descargarReporte: (id, f) => appReportes.descargarReporte(id, f),
  mostrarListaSincronizaciones: () => appReportes.mostrarListaSincronizaciones()
};

// Auto-iniciar cuando la página (y el puente nativo de Capacitor) esté completamente lista.
// Se usa 'load' en vez de 'DOMContentLoaded' porque este último dispara demasiado
// temprano — a veces antes de que Capacitor termine de conectar los plugins nativos
// (como SQLite), causando el error "CapacitorSQLitePlugin: null" en dispositivos reales.
window.addEventListener('load', () => {
  app.iniciar();
});