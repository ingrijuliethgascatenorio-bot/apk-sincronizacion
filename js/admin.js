/**
 * CONTROLADOR DEL PANEL ADMINISTRADOR (JS ES6)
 * Toda la lógica de la vista de Administrador (dashboard, inconsistencias,
 * auditoría, reportes y perfil) vive aquí, separada de app.js, para no
 * mezclar el flujo de Encuestador con el de Admin.
 */

import { apiService } from './api.service.js';
import { authService } from './auth.service.js';
import { reportesService } from './reportes.service.js';
import { renderizarPaginador, etiquetaCampoConflicto } from './ui.utils.js';

class AdminController {
  constructor() {
    this.filtroConflictoEstado = 'PENDIENTE';
    this.paginaConflictos = 1;
    this.paginaAuditoria = 1;
  }

  /**
   * Helper privado para realizar peticiones HTTP agregando cabecera de evasión de ngrok
   */
  async ejecutarFetch(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('auth_token');
    const url = apiService.buildUrl(endpoint);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': '69420'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const opciones = {
      method,
      headers
    };
    if (body) {
      opciones.body = JSON.stringify(body);
    }

    const response = await fetch(url, opciones);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const mensaje = errorData.message || `Error HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(mensaje);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  }

  /**
   * Carga métricas y saludo del Dashboard de Admin (Inicio)
   */
  async cargarAdminDashboard() {
    try {
      const metricas = await this.ejecutarFetch('/admin/conflictos/metricas');
      document.getElementById('admin-metric-personas').textContent = metricas.totalPersonas;
      document.getElementById('admin-metric-pendientes').textContent = metricas.pendientes;
      document.getElementById('admin-metric-resueltos').textContent = metricas.resueltos;
      document.getElementById('admin-metric-syncs').textContent = metricas.syncs;
      document.getElementById('admin-metric-encuestadores').textContent = metricas.encuestadores;

      const adminUser = authService.obtenerNombreCompleto();
      document.getElementById('admin-saludo').textContent = `Hola, ${adminUser}`;
      document.getElementById('admin-fecha').textContent = new Date().toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) {
      console.error('Error al cargar dashboard admin:', e);
    }
  }

  /**
   * Carga la bandeja de Inconsistencias (conflictos de sincronización)
   */
  async cargarAdminInconsistencias() {
    const contenedor = document.getElementById('lista-conflictos-contenedor');
    if (!contenedor) return;
    contenedor.innerHTML = `
      <div style="text-align: center; padding: 24px 16px; color: var(--color-text-muted);">
        Cargando inconsistencias...
      </div>
    `;

    let lista;
    try {
      lista = await this.ejecutarFetch(`/admin/conflictos?estado=${this.filtroConflictoEstado || 'PENDIENTE'}`);
    } catch (e) {
      console.error('Error al cargar inconsistencias:', e);
      contenedor.innerHTML = `
        <div style="text-align: center; padding: 24px 16px; color: var(--color-danger);">
          <ion-icon name="alert-circle-outline" style="font-size: 32px;"></ion-icon>
          <p style="margin-top: 8px;">No se pudieron cargar las inconsistencias.</p>
          <p style="font-size: 0.8rem; color: var(--color-text-muted);">${e.message || 'Error de conexión con el servidor.'}</p>
        </div>
      `;
      return;
    }

    try {
      contenedor.innerHTML = '';

      // Aplicar filtro de búsqueda local por documento
      const termino = (document.getElementById('admin-inconsistencias-busqueda')?.value || '').trim().toLowerCase();
      if (termino !== '') {
        lista = lista.filter(c => c.persona_documento.toLowerCase().includes(termino));
      }

      const totalItems = lista.length;
      const itemsPorPagina = 20;
      const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
      if (this.paginaConflictos > totalPaginas) {
        this.paginaConflictos = Math.max(1, totalPaginas);
      }

      if (totalItems === 0) {
        contenedor.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; color: var(--color-text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;"><ion-icon name="checkmark-circle" style="font-size: 48px; color: var(--color-success);"></ion-icon></div>
            <p>No se encontraron inconsistencias en este estado.</p>
          </div>
        `;
        renderizarPaginador(0, itemsPorPagina, 1, 'paginacion-conflictos', () => {});
        return;
      }

      const offset = (this.paginaConflictos - 1) * itemsPorPagina;
      const itemsAPresentar = lista.slice(offset, offset + itemsPorPagina);

      itemsAPresentar.forEach(c => {
        const item = document.createElement('div');
        item.className = 'tarjeta-persona';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'stretch';
        item.style.gap = '8px';
        item.style.padding = '16px';
        item.style.marginBottom = '12px';

        const badgeClass = c.estado === 'PENDIENTE' ? 'pendiente' : 'sincronizado';
        const badgeText = c.estado === 'PENDIENTE' ? 'PENDIENTE' : 'RESUELTO';

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="persona-nombre">Doc: ${c.persona_documento}</div>
              <div class="persona-sub">Campo: <strong style="color: var(--color-primary);">${etiquetaCampoConflicto(c.campo)}</strong></div>
            </div>
            <span class="insignia ${badgeClass}">${badgeText}</span>
          </div>
          <div style="margin-top: 6px; font-size: 0.85rem; color: var(--color-text-muted);">
            <div><strong>Actual:</strong> ${c.valor_actual}</div>
            <div style="color: var(--color-warning); font-weight: 600;"><strong>Recibido:</strong> ${c.valor_recibido}</div>
            <div style="margin-top: 4px; font-size: 0.8rem;">
              Enviado por: ${c.encuestador_nombre} (${c.origen}) · ${new Date(c.fecha_creacion).toLocaleString('es-CO')}
            </div>
          </div>
          ${c.estado === 'PENDIENTE' ? `
            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
              <button class="boton-principal" style="padding: 6px 12px; font-size: 0.85rem;" onclick="appAdmin.abrirModalConflicto(${c.id})">
                <ion-icon name="eye"></ion-icon> Revisar
              </button>
            </div>
          ` : `
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--color-border); font-size: 0.85rem;">
              <strong>Resolución:</strong> ${c.decision} (${c.valor_resuelto})
              <div style="font-size: 0.8rem; color: var(--color-text-muted); font-style: italic;">"${c.motivo}"</div>
            </div>
          `}
        `;
        contenedor.appendChild(item);
      });

      renderizarPaginador(totalItems, itemsPorPagina, this.paginaConflictos, 'paginacion-conflictos', (nuevaPag) => {
        this.paginaConflictos = nuevaPag;
        this.cargarAdminInconsistencias();
        const listCont = document.getElementById('lista-conflictos-contenedor');
        if (listCont) listCont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (e) {
      console.error('Error al cargar inconsistencias:', e);
    }
  }

  onBuscarInconsistencia(event) {
    this.paginaConflictos = 1;
    this.cargarAdminInconsistencias();
  }

  cambiarFiltroConf(estado, btnEl) {
    this.filtroConflictoEstado = estado;
    this.paginaConflictos = 1;
    document.querySelectorAll('.contenedor-filtros .boton-filtro').forEach(btn => btn.classList.remove('activo'));
    if (btnEl) btnEl.classList.add('activo');
    this.cargarAdminInconsistencias();
  }

  /**
   * Carga el historial de auditoría (conflictos ya resueltos)
   */
  async cargarAdminAuditoria() {
    try {
      let lista = await this.ejecutarFetch('/admin/conflictos?estado=RESUELTO');
      const contenedor = document.getElementById('lista-auditoria-contenedor');
      if (!contenedor) return;
      contenedor.innerHTML = '';

      // Aplicar término de búsqueda
      const termino = (document.getElementById('admin-auditoria-busqueda')?.value || '').trim().toLowerCase();
      if (termino !== '') {
        lista = lista.filter(c => c.persona_documento.toLowerCase().includes(termino));
      }

      // Aplicar filtro de fecha
      const filtroFecha = document.getElementById('admin-auditoria-fecha')?.value;
      if (filtroFecha) {
        lista = lista.filter(c => {
          const cFecha = new Date(c.fecha_resolucion || c.fecha_creacion).toISOString().split('T')[0];
          return cFecha === filtroFecha;
        });
      }

      const totalItems = lista.length;
      const itemsPorPagina = 20;
      const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
      if (this.paginaAuditoria > totalPaginas) {
        this.paginaAuditoria = Math.max(1, totalPaginas);
      }

      if (totalItems === 0) {
        contenedor.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; color: var(--color-text-muted);">
            <p>No se registran auditorías de resolución de conflictos aún.</p>
          </div>
        `;
        renderizarPaginador(0, itemsPorPagina, 1, 'paginacion-auditoria', () => {});
        return;
      }

      const offset = (this.paginaAuditoria - 1) * itemsPorPagina;
      const itemsAPresentar = lista.slice(offset, offset + itemsPorPagina);

      itemsAPresentar.forEach(c => {
        const item = document.createElement('div');
        item.className = 'tarjeta-blanca';
        item.style.marginBottom = '12px';
        item.style.padding = '16px';
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed var(--color-border); padding-bottom: 8px; margin-bottom: 8px;">
            <strong>Doc: ${c.persona_documento}</strong>
            <span class="insignia sincronizado" style="font-size: 0.75rem;">${c.decision}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--color-text-muted);">
            <div><strong>Campo afectado:</strong> ${etiquetaCampoConflicto(c.campo)}</div>
            <div><strong>Valor anterior:</strong> ${c.valor_actual}</div>
            <div><strong>Valor recibido:</strong> ${c.valor_recibido}</div>
            <div style="color: var(--color-text); font-weight: 600;"><strong>Valor aprobado:</strong> ${c.valor_resuelto}</div>
            <div style="margin-top: 8px; font-size: 0.8rem; border-top: 1px solid var(--color-border); padding-top: 6px;">
              <strong>Resuelto por:</strong> Admin el ${new Date(c.fecha_resolucion).toLocaleString('es-CO')}
            </div>
            <div style="font-size: 0.8rem; font-style: italic; margin-top: 4px; color: var(--color-primary);">
              "${c.motivo}"
            </div>
          </div>
        `;
        contenedor.appendChild(item);
      });

      renderizarPaginador(totalItems, itemsPorPagina, this.paginaAuditoria, 'paginacion-auditoria', (nuevaPag) => {
        this.paginaAuditoria = nuevaPag;
        this.cargarAdminAuditoria();
        const listCont = document.getElementById('lista-auditoria-contenedor');
        if (listCont) listCont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (e) {
      console.error('Error al cargar logs de auditoría:', e);
    }
  }

  onBuscarAuditoria(event) {
    this.paginaAuditoria = 1;
    this.cargarAdminAuditoria();
  }

  onCambiarFechaAuditoria(event) {
    this.paginaAuditoria = 1;
    this.cargarAdminAuditoria();
  }

  filtrarHoyAuditoria() {
    const hoyStr = new Date().toISOString().split('T')[0];
    const inputFecha = document.getElementById('admin-auditoria-fecha');
    if (inputFecha) inputFecha.value = hoyStr;
    this.paginaAuditoria = 1;
    this.cargarAdminAuditoria();
  }

  limpiarFiltrosAuditoria() {
    const inputBuscar = document.getElementById('admin-auditoria-busqueda');
    const inputFecha = document.getElementById('admin-auditoria-fecha');
    if (inputBuscar) inputBuscar.value = '';
    if (inputFecha) inputFecha.value = '';
    this.paginaAuditoria = 1;
    this.cargarAdminAuditoria();
  }

  /**
   * Carga las métricas globales de sincronización para las 3 tarjetas superiores
   * de Reportes Admin (Lotes, Nuevos, Actualizados) y dispara la carga de la
   * lista de sincronizaciones.
   */
  async cargarAdminReportes() {
    try {
      const metricas = await this.ejecutarFetch('/admin/conflictos/metricas');

      // Poblar las 3 tarjetas superiores con datos reales
      const elLotes = document.getElementById('admin-metric-lotes');
      const elNuevos = document.getElementById('admin-metric-nuevos');
      const elActualizados = document.getElementById('admin-metric-actualizados');

      if (elLotes) elLotes.textContent = metricas.syncs;
      if (elNuevos) elNuevos.textContent = metricas.totalNuevos;
      if (elActualizados) elActualizados.textContent = metricas.totalActualizados;
    } catch (e) {
      console.error('Error al cargar métricas de reportes admin:', e);
    }

    // Cargar la lista de sincronizaciones (asegurando que el detalle esté oculto)
    const listSec = document.getElementById('admin-reportes-lotes-seccion');
    const detSec = document.getElementById('admin-reporte-detalle-seccion');
    if (listSec) listSec.style.display = 'block';
    if (detSec) detSec.style.display = 'none';
    await adminReportesController.cargarReportes();
  }

  cargarAdminPerfil() {
    const adminUser = authService.obtenerNombreCompleto();
    const usr = authService.obtenerUsuarioActual();
    const rol = authService.obtenerRolActual();
    
    document.getElementById('admin-perfil-nombre').textContent = adminUser;
    document.getElementById('admin-perfil-avatar').textContent = adminUser.slice(0, 2).toUpperCase();

    const subAdminPerfil = document.querySelector('#vista-admin-perfil .tarjeta-blanca p');
    if (subAdminPerfil) {
      subAdminPerfil.innerHTML = `
        <strong>Usuario:</strong> ${usr}<br/>
        <strong>Rol asignado:</strong> <span class="insignia error" style="font-size: 0.75rem; margin-top: 4px; display: inline-block;">${rol}</span>
      `;
    }

    const temaActual = localStorage.getItem('theme_preference') || 'light';
    const select = document.getElementById('admin-select-tema');
    if (select) select.value = temaActual;
  }

  /**
   * Abre el modal de resolución para un conflicto puntual
   */
  async abrirModalConflicto(idConflicto) {
    try {
      const data = await this.ejecutarFetch(`/admin/conflictos/${idConflicto}`);
      if (!data) return;

      document.getElementById('resolucion-conf-id').value = data.conflicto.id;
      document.getElementById('conf-persona-nombre').textContent = `${data.persona?.nombres || 'Cargando...'} ${data.persona?.apellidos || ''}`;
      document.getElementById('conf-persona-doc').textContent = `Documento: ${data.conflicto.persona_documento}`;
      document.getElementById('conf-campo-nombre').textContent = etiquetaCampoConflicto(data.conflicto.campo);
      document.getElementById('conf-dato-oficial').textContent = data.conflicto.valor_actual || '(Vacío)';
      document.getElementById('conf-dato-recibido').textContent = data.conflicto.valor_recibido || '(Vacío)';
      document.getElementById('conf-info-encuestador').textContent = data.conflicto.encuestador_nombre || 'N/A';
      document.getElementById('conf-info-fecha').textContent = new Date(data.conflicto.fecha_creacion).toLocaleString('es-CO');
      document.getElementById('conf-info-version-servidor').textContent = data.conflicto.version_actual_servidor !== undefined && data.conflicto.version_actual_servidor !== null ? data.conflicto.version_actual_servidor : '1';
      document.getElementById('conf-info-version-encuestador').textContent = data.conflicto.version_base_recibida !== undefined && data.conflicto.version_base_recibida !== null ? data.conflicto.version_base_recibida : '1';

      const origenEl = document.getElementById('conf-info-origen');
      origenEl.textContent = data.conflicto.origen;
      origenEl.className = `insignia ${data.conflicto.origen === 'ONLINE' ? 'sincronizado' : 'pendiente'}`;

      document.getElementById('form-resolucion-conflicto').reset();
      document.getElementById('campo-resolucion-manual').style.display = 'none';
      document.getElementById('resolucion-valor-manual').required = false;

      document.getElementById('modal-conflicto').classList.add('activo');
    } catch (e) {
      alert(`Error al cargar detalle del conflicto: ${e.message}`);
    }
  }

  cerrarModalConflicto() {
    document.getElementById('modal-conflicto').classList.remove('activo');
  }

  onCambioDecisionResolucion(selectEl) {
    const campoManual = document.getElementById('campo-resolucion-manual');
    const inputManual = document.getElementById('resolucion-valor-manual');
    if (selectEl.value === 'EDICION_MANUAL') {
      campoManual.style.display = 'block';
      inputManual.required = true;
    } else {
      campoManual.style.display = 'none';
      inputManual.required = false;
      inputManual.value = '';
    }
  }

  async guardarResolucion(event) {
    event.preventDefault();
    const id = document.getElementById('resolucion-conf-id').value;
    const decision = document.getElementById('resolucion-decision').value;
    const valorEdicionManual = document.getElementById('resolucion-valor-manual').value.trim();
    const motivo = document.getElementById('resolucion-motivo').value.trim();

    try {
      const res = await this.ejecutarFetch(`/admin/conflictos/${id}/resolver`, 'POST', {
        decision,
        valorEdicionManual,
        motivo,
      });

      alert(res.mensaje || 'Conflicto resuelto exitosamente.');
      this.cerrarModalConflicto();
      await this.cargarAdminInconsistencias();
      await this.cargarAdminDashboard();
    } catch (e) {
      alert(`Error al resolver conflicto: ${e.message}`);
    }
  }
}

class AdminReportesController {
  constructor() {
    this.paginaReportes = 1;
    this.filtroFecha = '';
    this.terminoBusqueda = '';
  }

  async cargarReportes() {
    const contenedor = document.getElementById('admin-lista-reportes-sincronizaciones');
    if (!contenedor) return;

    contenedor.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Cargando sincronizaciones...</div>';

    try {
      const response = await adminController.ejecutarFetch(`/historial/sincronizaciones?pagina=${this.paginaReportes}&limite=10`);
      contenedor.innerHTML = '';

      let lista = response.datos || [];

      // Aplicar filtros locales de búsqueda y fecha
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
        contenedor.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted); font-size: 0.9rem;">No se encontraron sincronizaciones.</div>';
        renderizarPaginador(0, 10, 1, 'admin-paginacion-reportes-sync', () => {});
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
            <div><strong>Origen:</strong> ONLINE</div>
            <div><strong>Realizado por:</strong> ${s.nombre_usuario || 'Encuestador'}</div>
            <div><strong>Procesados:</strong> ${s.cantidad_registros || 0} registros</div>
            <div style="margin-top: 4px; font-weight: 600; color: var(--color-text);">
              Detalle: ${s.registros_nuevos || 0} nuevos · ${s.registros_actualizados || 0} actualizados · ${s.registros_error || 0} errores
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px dashed var(--color-border); padding-top: 10px;">
            <button class="boton-secundario" style="flex: 1; padding: 6px 12px; font-size: 0.85rem; min-height: 36px; border-radius: var(--radius-md);" onclick="appAdminReportes.abrirDetalle(${s.id})">
              Ver detalles
            </button>
            <button class="boton-principal" style="flex: 1; padding: 6px 12px; font-size: 0.85rem; min-height: 36px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; gap: 4px;" onclick="appAdminReportes.descargarReporte(${s.id}, 'pdf')">
              <ion-icon name="document-text-outline"></ion-icon> PDF
            </button>
          </div>
        `;
        contenedor.appendChild(tarjeta);
      });

      renderizarPaginador(response.total || 0, 10, this.paginaReportes, 'admin-paginacion-reportes-sync', (nuevaPag) => {
        this.paginaReportes = nuevaPag;
        this.cargarReportes();
      });

    } catch (e) {
      console.error('Error al cargar sincronizaciones en admin:', e);
      contenedor.innerHTML = `<div style="text-align: center; padding: 16px; color: var(--color-danger); font-size: 0.9rem;">${e.message || 'Error al cargar sincronizaciones.'}</div>`;
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
    const inputBusqueda = document.getElementById('admin-reportes-busqueda');
    const inputFecha = document.getElementById('admin-reportes-fecha');
    if (inputBusqueda) inputBusqueda.value = '';
    if (inputFecha) inputFecha.value = '';
    this.terminoBusqueda = '';
    this.filtroFecha = '';
    this.paginaReportes = 1;
    this.cargarReportes();
  }

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
    const listSec = document.getElementById('admin-reportes-lotes-seccion');
    const detSec = document.getElementById('admin-reporte-detalle-seccion');
    const detCont = document.getElementById('admin-reporte-detalle-contenido');

    if (!listSec || !detSec || !detCont) return;

    listSec.style.display = 'none';
    detSec.style.display = 'block';
    detCont.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--color-text-muted);">Cargando detalles de sincronización...</div>';

    try {
      const data = await adminController.ejecutarFetch(`/historial/sincronizaciones/${id}`);
      const s = data.sincronizacion;
      const cambios = data.cambios || [];

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

      const nuevos = cambios.filter(c => c.campo_modificado === 'REGISTRO_NUEVO');
      const actualizaciones = cambios.filter(c => c.campo_modificado !== 'REGISTRO_NUEVO');

      let nuevosHtml = '';
      if (nuevos.length > 0) {
        let cardsNuevas = '';
        nuevos.forEach(n => {
          const p = n.persona || {};
          let camposItems = '';
          const MAPA_CAMPOS_ETIQUETAS = {
            nombres: 'Nombre',
            apellidos: 'Apellido',
            fecha_nacimiento: 'Fecha de nacimiento',
            genero: 'Género',
            direccion: 'Dirección',
            barrio: 'Barrio',
            estrato: 'Estrato',
            correo: 'Correo',
            estado_civil: 'Estado civil',
            eps: 'EPS',
            telefono: 'Teléfono'
          };
          Object.keys(MAPA_CAMPOS_ETIQUETAS).forEach(key => {
            const val = p[key];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              camposItems += `
                <div style="background: var(--color-surface); border: 1px solid var(--color-border); padding: 10px; border-radius: var(--radius-md); margin-bottom: 8px;">
                  <div style="font-weight: 800; font-size: 0.85rem; color: var(--color-primary); text-transform: uppercase; margin-bottom: 4px;">
                    ${MAPA_CAMPOS_ETIQUETAS[key]}
                  </div>
                  <div style="font-size: 0.85rem; color: var(--color-danger); margin-bottom: 2px;">
                    <strong>ANTERIOR:</strong> No registrado
                  </div>
                  <div style="font-size: 0.85rem; color: var(--color-success);">
                    <strong>NUEVO:</strong> ${val}
                  </div>
                </div>
              `;
            }
          });

          cardsNuevas += `
            <div class="tarjeta-blanca" style="padding: 14px; margin-bottom: 12px; border-left: 4px solid var(--color-success); border-radius: var(--radius-md);">
              <h4 style="color: var(--color-success); margin: 0 0 6px 0; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                <ion-icon name="person-add-outline"></ion-icon> ACCIÓN: NUEVO REGISTRO
              </h4>
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--color-text); margin-bottom: 10px;">
                <div>Documento: ${n.numero_documento}</div>
                <div style="font-weight: normal; margin-top: 4px; color: var(--color-text-muted);">Estado: Registro creado correctamente</div>
              </div>
              <div style="font-size: 0.8rem; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 6px;">
                DETALLES
              </div>
              ${camposItems}
            </div>
          `;
        });
        nuevosHtml = `
          <h3 style="font-size: 1rem; font-weight: 800; margin: 16px 0 10px 0; color: var(--color-text);">PERSONAS NUEVAS</h3>
          ${cardsNuevas}
        `;
      }

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
            <div><strong>Realizado por:</strong> ${s.nombre_usuario || 'Encuestador'}</div>
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
          <button class="boton-principal" style="width: 100%; min-height: 44px; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="appAdminReportes.descargarReporte(${s.id}, 'pdf')">
            <ion-icon name="document-text-outline" style="font-size: 1.2rem;"></ion-icon> 📄 Descargar Reporte PDF
          </button>
        </div>
      `;
    } catch (e) {
      console.error('Error al cargar detalle en admin:', e);
      detCont.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--color-danger); font-size: 0.9rem;">Error al cargar detalle de sincronización: ${e.message || 'Error al cargar detalle.'}</div>`;
    }
  }

  mostrarListaSincronizaciones() {
    document.getElementById('admin-reportes-lotes-seccion').style.display = 'block';
    document.getElementById('admin-reporte-detalle-seccion').style.display = 'none';
  }

  async descargarReporte(id, formato = 'pdf') {
    try {
      const toast = document.createElement('div');
      toast.id = 'toast-descarga-pdf-admin';
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
      console.error('Error al descargar reporte admin:', e);
      const existingToast = document.getElementById('toast-descarga-pdf-admin');
      if (existingToast) existingToast.remove();
      alert(`No fue posible descargar el reporte: ${e.message || e}`);
    }
  }
}

export const adminController = new AdminController();
export const adminReportesController = new AdminReportesController();

