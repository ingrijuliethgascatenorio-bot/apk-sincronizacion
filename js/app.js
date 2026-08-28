/**
 * CONTROLADOR PRINCIPAL DEL FRONTEND NATIVO (JS ES6 MODULAR)
 * Coordina la interfaz, la navegación por pestañas, modales y eventos.
 */

import { Network } from '@capacitor/network';
import { sqliteService } from './sqlite.service.js';
import { authService } from './auth.service.js';
import { personasService } from './personas.service.js';
import { syncService } from './sync.service.js';
import { historialService } from './historial.service.js';
import { reportesService } from './reportes.service.js';
import { adminController } from './admin.js';
import { renderizarPaginador } from './ui.utils.js';

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
    this.filtroHistorialEstado = 'todos';
    this.filtroHistorialFecha = '';
    this.paginaHistorial = 1;
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
    } else if (nombreTab === 'admin-personas') {
      await adminController.cargarAdminPersonasView();
    } else if (nombreTab === 'admin-inconsistencias') {
      await adminController.cargarAdminInconsistenciasView();
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
        <div style="text-align: center; padding: 40px 16px; color: var(--color-text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;"><ion-icon name="search" style="font-size: 48px; color: var(--color-text-muted);"></ion-icon></div>
          <p>No se encontraron personas con los filtros seleccionados.</p>
        </div>
      `;
      return;
    }

    lista.forEach(p => {
      const iniciales = (p.nombres.charAt(0) + (p.apellidos.charAt(0) || '')).toUpperCase();
      const tipoDocText = MAPA_TIPO_DOC[p.id_tipo_documento] || 'DOC';
      const epsText = Number(p.id_eps) === 99 ? (p.eps_otro_nombre || 'Otra EPS') : (MAPA_EPS[p.id_eps] || 'EPS');

      let claseBadge = 'pendiente';
      let textBadge = 'Pendiente';
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

      // Sincronización automática: si hay conexión con el backend, sincroniza de inmediato con PostgreSQL.
      // Si está en modo offline o falla la red, queda guardado en SQLite local para sincronizar con el botón o al reconectar.
      // Nota: ya no se condiciona a navigator.onLine — esa bandera solo indica
      // que hay una interfaz de red activa, no que el backend sea alcanzable.
      // Se intenta sincronizar siempre; si falla (sin Internet real, backend
      // caído, etc.) el registro ya quedó guardado en SQLite y el catch de
      // abajo lo deja pendiente sin perder datos.
      let sincronizadoOnline = false;
      try {
        const resSync = await syncService.sincronizar();
        if (resSync && resSync.exito && resSync.procesados > 0) {
          sincronizadoOnline = true;
        }
      } catch (syncErr) {
        console.warn('⚠️ Sincronización automática no completada (modo offline activo):', syncErr.message);
      }

      await this.cargarPersonas();
      await this.cargarDashboard();

      if (sincronizadoOnline) {
        alert('Registro guardado y sincronizado automáticamente con el servidor central.');
      } else {
        alert('Registro guardado localmente en SQLite (se sincronizará al conectar o pulsar Sincronizar).');
      }
    } catch (e) {
      alert(`Error al guardar: ${e.message}`);
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
          <p> Todos los registros locales están sincronizados con PostgreSQL.</p>
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
      // Renueva el token si está por expirar, antes de intentar el envío.
      await authService.refrescarSiNecesario();
      const res = await syncService.sincronizar();
      alert(res.mensaje);
      await this.cargarSincronizar();
      await this.cargarDashboard();
    } catch (e) {
      alert(`Error al sincronizar con el servidor: ${e.message}`);
    }
  }

  /**
   * Carga la vista de Historial (Agrupando de forma visual intentos fallidos consecutivos)
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

    // Algoritmo de agrupación visual para intentos de error consecutivos en el historial.
    // Se suma el desglose real (nuevos/actualizados/errores/inconsistencias) de cada
    // intento agrupado — igual que ya se hacía con cantidad_registros — para no
    // inventar ni perder datos cuando varios intentos fallidos se muestran como una
    // sola tarjeta.
    const agrupados = [];
    let actualGroup = null;

    logs.forEach(log => {
      if (log.estado === 'ERROR') {
        if (actualGroup && actualGroup.estado === 'ERROR') {
          actualGroup.intentos = (actualGroup.intentos || 1) + 1;
          actualGroup.mensaje = log.mensaje; // Conservar el mensaje del último intento
          actualGroup.cantidad_registros += log.cantidad_registros;
          actualGroup.registros_nuevos += (log.registros_nuevos || 0);
          actualGroup.registros_actualizados += (log.registros_actualizados || 0);
          actualGroup.registros_error += (log.registros_error || 0);
          actualGroup.registros_conflictos += (log.registros_conflictos || 0);
        } else {
          actualGroup = {
            ...log,
            intentos: 1,
            registros_nuevos: log.registros_nuevos || 0,
            registros_actualizados: log.registros_actualizados || 0,
            registros_error: log.registros_error || 0,
            registros_conflictos: log.registros_conflictos || 0,
          };
          agrupados.push(actualGroup);
        }
      } else {
        actualGroup = {
          ...log,
          intentos: 1,
          registros_nuevos: log.registros_nuevos || 0,
          registros_actualizados: log.registros_actualizados || 0,
          registros_error: log.registros_error || 0,
          registros_conflictos: log.registros_conflictos || 0,
        };
        agrupados.push(actualGroup);
      }
    });

    // ─── Filtros (estado + fecha) sobre los datos YA agrupados ───────────
    let filtrados = agrupados;
    if (this.filtroHistorialEstado === 'completados') {
      filtrados = filtrados.filter(l => l.estado === 'ÉXITO');
    } else if (this.filtroHistorialEstado === 'errores') {
      filtrados = filtrados.filter(l => l.estado === 'ERROR');
    }
    if (this.filtroHistorialFecha) {
      filtrados = filtrados.filter(l => {
        const f = new Date(l.fecha_fin);
        const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
        return iso === this.filtroHistorialFecha;
      });
    }

    if (filtrados.length === 0) {
      contenedor.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--color-text-muted);">
          <p>No hay registros que coincidan con los filtros aplicados.</p>
        </div>
      `;
      renderizarPaginador(0, 10, 1, 'paginacion-historial', () => {});
      return;
    }

    // ─── Paginación (cliente, sobre el listado local ya filtrado) ────────
    const itemsPorPagina = 10;
    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itemsPorPagina));
    if (this.paginaHistorial > totalPaginas) this.paginaHistorial = totalPaginas;
    const inicio = (this.paginaHistorial - 1) * itemsPorPagina;
    const pagina = filtrados.slice(inicio, inicio + itemsPorPagina);

    // Timeline vertical: un ítem por registro, con su línea conectora y su
    // punto de estado (verde = sincronizado, rojo = con errores).
    const wrapper = document.createElement('div');
    wrapper.className = 'historial-timeline';

    pagina.forEach((log, idx) => {
      const esExito = log.estado === 'ÉXITO';
      const fechaObj = new Date(log.fecha_fin);
      const fechaStr = fechaObj.toLocaleDateString('es-CO');
      const horaStr = fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

      let estadoTexto, estadoIcono;
      if (esExito) {
        estadoTexto = 'Sincronizado';
        estadoIcono = 'checkmark-circle-outline';
      } else {
        const n = log.intentos || 1;
        estadoTexto = `Errores · ${n} ${n === 1 ? 'intento' : 'intentos'}`;
        estadoIcono = 'alert-circle-outline';
      }

      const item = document.createElement('div');
      item.className = 'historial-item';
      const esUltimo = idx === pagina.length - 1;

      item.innerHTML = `
        <div class="historial-timeline-col">
          <div class="historial-punto ${esExito ? 'exito' : 'error'}"></div>
          <div class="historial-linea" style="${esUltimo ? 'visibility: hidden;' : ''}"></div>
        </div>
        <div class="historial-card-col">
          <div class="tarjeta-historial">
            <div class="historial-encabezado">
              <div>
                <strong class="historial-fecha">${fechaStr}</strong>
                <div class="historial-hora">${horaStr}</div>
              </div>
              <span class="insignia-historial ${esExito ? 'exito' : 'error'}">
                <ion-icon name="${estadoIcono}"></ion-icon> ${estadoTexto}
              </span>
            </div>

            <div class="historial-metricas">
              <div class="historial-metrica">
                <span class="historial-metrica-valor">${log.cantidad_registros || 0}</span>
                <span class="historial-metrica-label">Total</span>
              </div>
              <div class="historial-metrica">
                <span class="historial-metrica-valor">${log.registros_nuevos || 0}</span>
                <span class="historial-metrica-label">Nuevos</span>
              </div>
              <div class="historial-metrica">
                <span class="historial-metrica-valor">${log.registros_actualizados || 0}</span>
                <span class="historial-metrica-label">Act.</span>
              </div>
              <div class="historial-metrica">
                <span class="historial-metrica-valor">${log.registros_error || 0}</span>
                <span class="historial-metrica-label">Errores</span>
              </div>
            </div>

            <div class="historial-inconsistencias">
              <span><ion-icon name="warning-outline"></ion-icon> Inconsistencias</span>
              <span class="historial-inconsistencias-valor">${log.registros_conflictos || 0}</span>
            </div>
          </div>
        </div>
      `;
      wrapper.appendChild(item);
    });

    contenedor.appendChild(wrapper);

    renderizarPaginador(filtrados.length, itemsPorPagina, this.paginaHistorial, 'paginacion-historial', (nuevaPag) => {
      this.paginaHistorial = nuevaPag;
      this.cargarHistorial();
    });
  }

  /**
   * Cambia el filtro de estado del Historial (Todos / Completados / Con errores)
   * y refresca la lista. Recibe el botón clickeado para marcarlo como activo.
   */
  setFiltroHistorial(filtro, btnEl) {
    this.filtroHistorialEstado = filtro;
    this.paginaHistorial = 1;
    if (btnEl && btnEl.parentElement) {
      btnEl.parentElement.querySelectorAll('.boton-filtro').forEach(b => b.classList.remove('activo'));
      btnEl.classList.add('activo');
    }
    this.cargarHistorial();
  }

  /**
   * Filtra el Historial por una fecha exacta (YYYY-MM-DD del input date).
   */
  onCambiarFechaHistorial(event) {
    this.filtroHistorialFecha = event.target.value || '';
    this.paginaHistorial = 1;
    this.cargarHistorial();
  }

  /**
   * Limpia el filtro de fecha del Historial.
   */
  limpiarFechaHistorial() {
    this.filtroHistorialFecha = '';
    const input = document.getElementById('historial-filtro-fecha');
    if (input) input.value = '';
    this.paginaHistorial = 1;
    this.cargarHistorial();
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
    this.terminoBusqueda = '';
    this.filtroEstado = 'TODOS';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
  }

  async cargarReportes() {
    const contenedor = document.getElementById('lista-reportes-sincronizaciones');
    if (!contenedor) return;

    contenedor.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Cargando tus reportes...</div>';

    try {
      const filtros = {
        busqueda: this.terminoBusqueda,
        estado: this.filtroEstado,
        fechaDesde: this.filtroFechaDesde,
        fechaHasta: this.filtroFechaHasta
      };

      const response = await reportesService.listarSincronizaciones(this.paginaReportes, 10, filtros);
      contenedor.innerHTML = '';

      let lista = response.datos || [];

      if (lista.length === 0) {
        contenedor.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted); font-size: 0.9rem;">No se encontraron sincronizaciones con los filtros aplicados.</div>';
        renderizarPaginador(0, 10, 1, 'paginacion-reportes-sync', () => {});
        return;
      }

      lista.forEach(s => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-blanca';
        tarjeta.style.marginBottom = '12px';
        tarjeta.style.padding = '14px 16px';
        tarjeta.style.borderRadius = 'var(--radius-lg)';

        const fechaStr = new Date(s.fecha_inicio).toLocaleString('es-CO');
        const esError = s.estado === 'ERROR' || (s.registros_error && s.registros_error > 0);
        const estadoLabel = esError ? 'ERROR' : (s.estado === 'COMPLETADO' ? 'COMPLETADA' : s.estado);
        const estadoClass = esError ? 'error' : 'completamente-exitosa';

        tarjeta.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin-bottom: 10px;">
            <strong style="color: var(--color-primary); font-size: 1.05rem;">Sincronización #${s.id}</strong>
            <span class="insignia ${estadoClass}">${estadoLabel}</span>
          </div>
          <div style="font-size: 0.88rem; color: var(--color-text-muted); line-height: 1.5;">
            <div><strong>Fecha:</strong> ${fechaStr}</div>
            <div><strong>Procesados:</strong> ${s.cantidad_registros || 0} registros</div>
            <div style="margin-top: 4px; font-weight: 600; color: var(--color-text);">
              Detalle: ${s.registros_nuevos || 0} nuevos · ${s.registros_actualizados || 0} actualizados · ${s.registros_error || 0} errores
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px dashed var(--color-border); padding-top: 10px;">
            <button class="boton-secundario" style="flex: 1; padding: 6px 12px; font-size: 0.85rem; min-height: 36px; border-radius: var(--radius-md);" onclick="appReportes.abrirDetalle(${s.id})">
              Ver detalles
            </button>
            <button class="boton-principal" style="flex: 1; padding: 6px 12px; font-size: 0.85rem; min-height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="appReportes.descargarReporte(${s.id}, 'pdf')">
              <ion-icon name="document-text-outline"></ion-icon> PDF
            </button>
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
      contenedor.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--color-danger); font-size: 0.9rem;">${e.message || 'Error de conexión con el servidor.'}</div>`;
    }
  }

  onBuscarInput(event) {
    this.terminoBusqueda = event.target.value.trim();
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  onCambiarEstado(event) {
    this.filtroEstado = event.target.value;
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  onCambiarFechaDesde(event) {
    this.filtroFechaDesde = event.target.value;
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  onCambiarFechaHasta(event) {
    this.filtroFechaHasta = event.target.value;
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  limpiarFiltros() {
    const inputBusqueda = document.getElementById('reportes-input-busqueda');
    const selectEstado = document.getElementById('reportes-filtro-estado');
    const inputDesde = document.getElementById('reportes-filtro-fecha-desde');
    const inputHasta = document.getElementById('reportes-filtro-fecha-hasta');

    if (inputBusqueda) inputBusqueda.value = '';
    if (selectEstado) selectEstado.value = 'TODOS';
    if (inputDesde) inputDesde.value = '';
    if (inputHasta) inputHasta.value = '';

    this.terminoBusqueda = '';
    this.filtroEstado = 'TODOS';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  // Nombre "bonito" para cada campo interno, igual que en el PDF
  // (Nombre, Dirección, Teléfono...) en vez del nombre técnico crudo.
  _etiquetaCampo(campo) {
    const ETIQUETAS = {
      nombres: 'Nombre',
      apellidos: 'Apellido',
      fecha_nacimiento: 'Fecha de nacimiento',
      genero: 'Género',
      direccion: 'Dirección',
      barrio: 'Barrio',
      estrato: 'Estrato',
      correo: 'Correo',
      estado_civil: 'Estado civil',
      id_eps: 'EPS',
      eps_otro_nombre: 'EPS (otro)',
      telefono1: 'Teléfono 1',
      telefono2: 'Teléfono 2',
      telefono3: 'Teléfono 3',
    };
    return ETIQUETAS[campo] || campo;
  }

  async abrirDetalle(id) {
    const listSec = document.getElementById('reporte-general-seccion');
    const detSec = document.getElementById('reporte-detalle-seccion');
    const detCont = document.getElementById('reporte-detalle-contenido');

    if (!listSec || !detSec || !detCont) return;

    listSec.style.display = 'none';
    detSec.style.display = 'block';
    detCont.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Cargando detalles de sincronización...</div>';

    try {
      const data = await reportesService.obtenerDetalleSincronizacion(id);
      const s = data.sincronizacion;
      const cambios = data.cambios || [];

      // Inspeccionar errores guardados en observaciones
      let erroresList = [];
      if (s.observaciones) {
        try {
          const obsJson = JSON.parse(s.observaciones);
          if (obsJson && Array.isArray(obsJson.errores) && obsJson.errores.length > 0) {
            erroresList = obsJson.errores;
          }
        } catch (e) {
          if (s.observaciones.trim() !== '' && s.observaciones !== '[]' && s.observaciones !== '{}') {
            erroresList = [s.observaciones];
          }
        }
      }

      const tieneErrores = (s.registros_error && s.registros_error > 0) || erroresList.length > 0 || s.estado === 'ERROR';
      const estadoClass = tieneErrores ? 'error' : 'completamente-exitosa';
      const estadoLabel = tieneErrores ? 'ERROR' : (s.estado === 'COMPLETADO' ? 'COMPLETADA' : s.estado);

      // Separar cambios entre REGISTROS NUEVOS y ACTUALIZACIONES
      const nuevos = cambios.filter(c => c.campo_modificado === 'REGISTRO_NUEVO');
      const actualizaciones = cambios.filter(c => c.campo_modificado !== 'REGISTRO_NUEVO');

      // 1. Render de Personas Nuevas con datos completos
      let nuevosHtml = '';
      if (nuevos.length > 0) {
        let cardsNuevas = '';
        nuevos.forEach(n => {
          const p = n.persona || {};
          cardsNuevas += `
            <div class="tarjeta-blanca" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid var(--color-success); border-radius: var(--radius-md);">
              <h4 style="color: var(--color-success); margin: 0 0 8px 0; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                <ion-icon name="person-add-outline"></ion-icon> PERSONA NUEVA
              </h4>
              <div style="font-size: 0.88rem; line-height: 1.6; color: var(--color-text);">
                <div><strong>Documento:</strong> ${n.numero_documento}</div>
                ${p.nombres || p.apellidos ? `<div><strong>Nombre:</strong> ${p.nombres || ''} ${p.apellidos || ''}</div>` : ''}
                ${p.direccion ? `<div><strong>Dirección:</strong> ${p.direccion}</div>` : ''}
                ${p.telefono ? `<div><strong>Teléfono:</strong> ${p.telefono}</div>` : ''}
                ${p.correo ? `<div><strong>Correo:</strong> ${p.correo}</div>` : ''}
                ${p.eps ? `<div><strong>EPS:</strong> ${p.eps}</div>` : ''}
                ${p.barrio ? `<div><strong>Barrio:</strong> ${p.barrio}</div>` : ''}
                ${p.genero ? `<div><strong>Género:</strong> ${p.genero}</div>` : ''}
                ${p.fecha_nacimiento ? `<div><strong>Fecha Nacimiento:</strong> ${p.fecha_nacimiento}</div>` : ''}
              </div>
            </div>
          `;
        });
        nuevosHtml = `
          <h3 style="font-size: 1rem; font-weight: 800; margin: 16px 0 10px 0; color: var(--color-text);">PERSONAS NUEVAS</h3>
          ${cardsNuevas}
        `;
      }

      // 2. Render de Personas Actualizadas campo por campo
      let actHtml = '';
      if (actualizaciones.length > 0) {
        const porDoc = {};
        actualizaciones.forEach(c => {
          if (!porDoc[c.numero_documento]) porDoc[c.numero_documento] = [];
          porDoc[c.numero_documento].push(c);
        });

        let cardsAct = '';
        Object.keys(porDoc).forEach(doc => {
          const listaCambios = porDoc[doc];
          let camposItems = '';
          listaCambios.forEach(item => {
            camposItems += `
              <div style="background: var(--color-surface); border: 1px solid var(--color-border); padding: 10px; border-radius: var(--radius-md); margin-bottom: 8px;">
                <div style="font-weight: 800; font-size: 0.85rem; color: var(--color-primary); text-transform: uppercase; margin-bottom: 4px;">
                  ${this._etiquetaCampo(item.campo_modificado)}
                </div>
                <div style="font-size: 0.85rem; color: var(--color-danger); margin-bottom: 2px;">
                  <strong>ANTERIOR:</strong> ${item.valor_anterior !== null && item.valor_anterior !== undefined ? item.valor_anterior : '(vacío)'}
                </div>
                <div style="font-size: 0.85rem; color: var(--color-success);">
                  <strong>NUEVO:</strong> ${item.valor_nuevo !== null && item.valor_nuevo !== undefined ? item.valor_nuevo : '(vacío)'}
                </div>
              </div>
            `;
          });

          cardsAct += `
            <div class="tarjeta-blanca" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid var(--color-warning); border-radius: var(--radius-md);">
              <h4 style="color: var(--color-primary); margin: 0 0 6px 0; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                <ion-icon name="create-outline"></ion-icon> PERSONA ACTUALIZADA
              </h4>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--color-text); margin-bottom: 10px;">
                Documento: ${doc}
              </div>
              <div style="font-size: 0.8rem; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 6px;">
                CAMBIOS
              </div>
              ${camposItems}
            </div>
          `;
        });

        actHtml = `
          <h3 style="font-size: 1rem; font-weight: 800; margin: 16px 0 10px 0; color: var(--color-text);">PERSONAS ACTUALIZADAS</h3>
          ${cardsAct}
        `;
      }

      // 3. Registros sin cambios
      let sinCambiosHtml = '';
      if (s.registros_sin_cambios && s.registros_sin_cambios > 0) {
        sinCambiosHtml = `
          <div class="tarjeta-blanca" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid var(--color-border); border-radius: var(--radius-md);">
            <h4 style="color: var(--color-text-muted); margin: 0 0 6px 0; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <ion-icon name="checkmark-circle-outline"></ion-icon> SIN CAMBIOS
            </h4>
            <div style="font-size: 0.88rem; color: var(--color-text-muted);">
              Se procesaron ${s.registros_sin_cambios} registro(s) que no requirieron modificaciones (datos idénticos al servidor).
            </div>
          </div>
        `;
      }

      // 4. Errores de procesamiento
      let erroresHtml = '';
      if (tieneErrores) {
        let itemsErrores = '';
        if (erroresList.length > 0) {
          itemsErrores = erroresList.map(err => `<li style="margin-bottom: 4px;">${err}</li>`).join('');
        } else {
          itemsErrores = `<li>La sincronización finalizó con estado ERROR (${s.registros_error || 0} registro(s) con fallo).</li>`;
        }

        erroresHtml = `
          <div style="background: #fdf2f2; border: 1px solid var(--color-danger); border-radius: var(--radius-md); padding: 14px; margin-bottom: 16px;">
            <h4 style="color: var(--color-danger); margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; gap: 6px;">
              <ion-icon name="warning-outline"></ion-icon> ERRORES DE PROCESAMIENTO
            </h4>
            <ul style="margin: 0; padding-left: 20px; font-size: 0.85rem; color: #991b1b; line-height: 1.4;">
              ${itemsErrores}
            </ul>
          </div>
        `;
      }

      detCont.innerHTML = `
        <div class="tarjeta-blanca" style="padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 8px;">
            <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--color-primary); margin: 0;">Sincronización #${s.id}</h2>
            <span class="insignia ${estadoClass}">${estadoLabel}</span>
          </div>

          <div style="font-size: 0.88rem; line-height: 1.6; color: var(--color-text-muted);">
            <div><strong>Fecha:</strong> ${new Date(s.fecha_inicio).toLocaleString('es-CO')}</div>
            <div><strong>Origen:</strong> ONLINE</div>
            <div><strong>Duración:</strong> ${s.duracion_ms ? (s.duracion_ms / 1000).toFixed(2) + 's' : 'N/A'}</div>
          </div>

          <div style="margin-top: 14px; background: var(--color-surface); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <div style="font-weight: 800; font-size: 0.9rem; color: var(--color-text); margin-bottom: 8px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px;">RESUMEN DE PROCESAMIENTO</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 0.85rem; color: var(--color-text-muted);">
              <div>Total procesadas: <strong>${s.cantidad_registros || 0}</strong></div>
              <div>Personas nuevas: <strong>${s.registros_nuevos || 0}</strong></div>
              <div>Actualizadas: <strong>${s.registros_actualizados || 0}</strong></div>
              <div>Sin cambios: <strong>${s.registros_sin_cambios || 0}</strong></div>
              <div>Errores: <strong style="color: ${s.registros_error ? 'var(--color-danger)' : 'inherit'};">${s.registros_error || 0}</strong></div>
              <div>Conflictos: <strong>${s.registros_conflictos || 0}</strong></div>
            </div>
          </div>
        </div>

        ${nuevosHtml}
        ${actHtml}
        ${sinCambiosHtml}
        ${erroresHtml}

        <div style="margin-top: 16px; margin-bottom: 24px;">
          <button class="boton-principal" style="width: 100%; min-height: 44px; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="appReportes.descargarReporte(${s.id}, 'pdf')">
            <ion-icon name="document-text-outline" style="font-size: 1.2rem;"></ion-icon> Descargar Reporte PDF
          </button>
        </div>
      `;
    } catch (e) {
      console.error('Error al cargar detalle:', e);
      detCont.innerHTML = `<div style="text-align: center; color: var(--color-danger); padding: 20px; font-size: 0.9rem;">Error al cargar detalle de sincronización: ${e.message || 'Error de red'}</div>`;
    }
  }

  mostrarListaSincronizaciones() {
    document.getElementById('reporte-general-seccion').style.display = 'block';
    document.getElementById('reporte-detalle-seccion').style.display = 'none';
  }

  async descargarReporte(id, formato = 'pdf') {
    try {
      const toast = document.createElement('div');
      toast.id = 'toast-descarga-pdf';
      toast.style.cssText = 'position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%); background: #1e293b; color: #ffffff; padding: 12px 20px; border-radius: 24px; font-size: 0.88rem; font-weight: 600; z-index: 99999; box-shadow: 0 4px 14px rgba(0,0,0,0.35); text-align: center; animation: fadeIn 200ms ease; min-width: 250px;';
      toast.innerText = 'Generando y descargando PDF...';
      document.body.appendChild(toast);

      const res = await reportesService.guardarReporteEnDispositivo(id, formato);

      toast.style.background = '#059669';
      toast.innerText = `Reporte descargado correctamente:\n${res.filename}`;

      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 4000);
    } catch (e) {
      console.error('Error al descargar reporte:', e);
      const existingToast = document.getElementById('toast-descarga-pdf');
      if (existingToast) existingToast.remove();
      alert(`No fue posible descargar el reporte: ${e.message || e}`);
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
  setFiltroHistorial: (filtro, btnEl) => app.setFiltroHistorial(filtro, btnEl),
  onCambiarFecha: (event) => app.onCambiarFechaHistorial(event),
  limpiarFecha: () => app.limpiarFechaHistorial()
};

window.appReportes = appReportes;

window.appAdmin = {
  cambiarFiltroConf: (est, btn) => adminController.cambiarFiltroConf(est, btn),
  abrirModalConflicto: (id) => adminController.abrirModalConflicto(id),
  cerrarModalConflicto: () => adminController.cerrarModalConflicto(),
  onCambioDecisionResolucion: (el) => adminController.onCambioDecisionResolucion(el),
  guardarResolucion: (e) => adminController.guardarResolucion(e),
  onBuscarInconsistencia: (e) => adminController.onBuscarInconsistencia(e),
  onBuscarAuditoria: (e) => adminController.onBuscarAuditoria(e),
  cambiarSubTabInconsistencias: (tab) => adminController.cambiarSubTabInconsistencias(tab),
  cambiarSubTabPersonas: (tab) => adminController.cambiarSubTabPersonas(tab),
  onBuscarPersonas: (e) => adminController.onBuscarPersonas(e),
  filtrarPersonasPorEncuestador: (id, btn) => adminController.filtrarPersonasPorEncuestador(id, btn),
  onCambiarFechaPersonas: (e) => adminController.onCambiarFechaPersonas(e),
  toggleErroresPersonas: () => adminController.toggleErroresPersonas(),
  limpiarFiltrosPersonas: () => adminController.limpiarFiltrosPersonas(),
  abrirModalNuevoUsuario: () => adminController.abrirModalNuevoUsuario(),
  cerrarModalNuevoUsuario: () => adminController.cerrarModalNuevoUsuario(),
  guardarNuevoUsuario: (e) => adminController.guardarNuevoUsuario(e),
  abrirModalEditarUsuario: (id) => adminController.abrirModalEditarUsuario(id),
  abrirModalPersonasUsuario: (id) => adminController.abrirModalPersonasUsuario(id),
  cerrarModalPersonasUsuario: () => adminController.cerrarModalPersonasUsuario(),
  abrirDetallePersona: (doc) => adminController.abrirDetallePersona(doc),
  cerrarDetallePersona: () => adminController.cerrarDetallePersona()
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
  mostrarListaSincronizaciones: () => adminReportesController.mostrarListaSincronizaciones(),
  abrirDetalle: (id) => adminReportesController.abrirDetalle(id)
};

// Auto-iniciar cuando la página (y el puente nativo de Capacitor) esté completamente lista.
window.addEventListener('load', () => {
  app.iniciar();
});

/**
 * SINCRONIZACIÓN AUTOMÁTICA AL RECUPERAR CONEXIÓN
 * -------------------------------------------------
 * `navigator.onLine` / el evento `window.online` SOLO indican que el
 * dispositivo tiene una interfaz de red activa (Wi-Fi o datos conectados),
 * NO que exista Internet real ni que el backend sea alcanzable. Por eso un
 * celular puede estar "conectado" al Wi-Fi y aun así no tener salida a
 * Internet (portal cautivo, Wi-Fi sin Internet, DNS caído, VPN, etc.), y el
 * evento 'online' del WebView puede no dispararse de forma confiable dentro
 * de la app empaquetada con Capacitor.
 *
 * Por eso usamos el plugin nativo @capacitor/network (más confiable en
 * Android/iOS) como mecanismo principal, dejamos el evento del navegador
 * como respaldo, y además reintentamos sincronizar periódicamente y al
 * volver del segundo plano — así, aunque se nos escape el evento exacto de
 * reconexión, los registros pendientes igual se envían apenas hay Internet.
 */
async function intentarSincronizarPendientes(origen) {
  // Evita sincronizar (y evita forzar un cierre de sesión) si el usuario
  // no está logueado, por ejemplo cuando la reconexión ocurre en la
  // pantalla de login.
  if (!authService.estaAutenticado()) return;

  // Sesión deslizante: aprovechamos cada ciclo (reconexión, reintento
  // periódico, o reanudar la app) para renovar el token si está por
  // expirar, así una jornada de campo larga no corta la sesión a mitad
  // de trabajo mientras el encuestador siga usando la app.
  await authService.refrescarSiNecesario();

  try {
    const pendientes = await syncService.obtenerPendientes();
    if (!pendientes || pendientes.length === 0) return;

    console.log(`📶 [Sync automática · ${origen}] Hay ${pendientes.length} registro(s) pendiente(s). Intentando sincronizar...`);
    const res = await syncService.sincronizar();
    if (res && res.procesados > 0) {
      await app.cargarPersonas();
      await app.cargarDashboard();
      if (document.getElementById('vista-sincronizar')?.classList.contains('activa')) {
        await app.cargarSincronizar();
      }
    }
  } catch (e) {
    // No hay Internet real todavía, o el servidor no respondió: se queda
    // guardado en SQLite local y se reintentará en el próximo ciclo.
    console.warn(`⚠️ [Sync automática · ${origen}] No se pudo sincronizar todavía:`, e.message);
  }
}

// 1) Mecanismo principal: plugin nativo de Capacitor (Android/iOS)
try {
  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) {
      intentarSincronizarPendientes('Network plugin');
    }
  });
} catch (e) {
  console.warn('⚠️ Plugin @capacitor/network no disponible, usando solo eventos del navegador:', e);
}

// 2) Respaldo: evento estándar del navegador (útil también en la versión web)
window.addEventListener('online', () => intentarSincronizarPendientes('evento online'));

// 3) Red de seguridad: reintento periódico por si se nos escapa el evento de
//    reconexión (frecuente en WebViews). No hace daño si no hay pendientes,
//    porque sincronizar() no llama a la red cuando la lista está vacía.
const INTERVALO_REINTENTO_SYNC_MS = 60000; // 1 minuto
setInterval(() => intentarSincronizarPendientes('reintento periódico'), INTERVALO_REINTENTO_SYNC_MS);

// 4) Al volver del segundo plano (usuario reabre la app), intenta sincronizar
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    intentarSincronizarPendientes('app reanudada');
  }
});