/**
 * CONTROLADOR DEL PANEL ADMINISTRADOR (JS ES6)
 * Toda la lógica de la vista de Administrador (dashboard, inconsistencias,
 * auditoría, reportes y perfil) vive aquí, separada de app.js, para no
 * mezclar el flujo de Encuestador con el de Admin.
 */

import { apiService } from './api.service.js';
import { authService } from './auth.service.js';
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
   * Carga la bandeja de Inconsistencias (conflictos de sincronización agrupados por persona)
   */
  async cargarAdminInconsistencias() {
    const contenedor = document.getElementById('lista-conflictos-contenedor');
    if (!contenedor) return;
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <div class="estado-vacio-icono"><ion-icon name="sync-outline" style="animation: spin 1s infinite linear;"></ion-icon></div>
        <div class="estado-vacio-titulo">Cargando inconsistencias...</div>
        <div class="estado-vacio-desc">Consultando registros pendientes con el servidor.</div>
      </div>
    `;

    let lista;
    try {
      lista = await this.ejecutarFetch(`/admin/conflictos?estado=${this.filtroConflictoEstado || 'PENDIENTE'}`);
    } catch (e) {
      console.error('Error al cargar inconsistencias:', e);
      contenedor.innerHTML = `
        <div class="estado-vacio">
          <div class="estado-vacio-icono alerta"><ion-icon name="alert-circle-outline"></ion-icon></div>
          <div class="estado-vacio-titulo">No se pudieron cargar las inconsistencias</div>
          <div class="estado-vacio-desc">${e.message || 'Error de conexión con el servidor.'}</div>
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

      // AGRUPAR POR PERSONA (1 PERSONA = 1 TARJETA)
      const agrupadosMap = new Map();
      lista.forEach(c => {
        const doc = c.persona_documento;
        if (!agrupadosMap.has(doc)) {
          agrupadosMap.set(doc, {
            persona_documento: doc,
            persona_nombre: c.persona_nombre || '',
            encuestador_nombre: c.encuestador_nombre || 'No disponible',
            origen: c.origen || 'OFFLINE',
            fecha_creacion: c.fecha_creacion,
            estado: c.estado,
            conflictos: []
          });
        }
        agrupadosMap.get(doc).conflictos.push(c);
      });

      const grupos = Array.from(agrupadosMap.values());
      const totalItems = grupos.length;
      const itemsPorPagina = 10;
      const totalPaginas = Math.ceil(totalItems / itemsPorPagina);
      if (this.paginaConflictos > totalPaginas) {
        this.paginaConflictos = Math.max(1, totalPaginas);
      }

      if (totalItems === 0) {
        contenedor.innerHTML = `
          <div class="estado-vacio">
            <div class="estado-vacio-icono exito"><ion-icon name="checkmark-circle-outline"></ion-icon></div>
            <div class="estado-vacio-titulo">No hay inconsistencias en este estado</div>
            <div class="estado-vacio-desc">Todos los registros sincronizados se encuentran en orden.</div>
          </div>
        `;
        renderizarPaginador(0, itemsPorPagina, 1, 'paginacion-conflictos', () => {});
        return;
      }

      const offset = (this.paginaConflictos - 1) * itemsPorPagina;
      const gruposAPresentar = grupos.slice(offset, offset + itemsPorPagina);

      gruposAPresentar.forEach(grupo => {
        const numConflictos = grupo.conflictos.length;
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-inconsistencia-agrupada';

        const badgeClass = grupo.estado === 'PENDIENTE' ? 'pendiente' : 'sincronizado';
        const badgeText = grupo.estado === 'PENDIENTE'
          ? `${numConflictos} ${numConflictos === 1 ? 'inconsistencia' : 'inconsistencias'}`
          : `${numConflictos} ${numConflictos === 1 ? 'resuelta' : 'resueltas'}`;

        let camposHtml = '';
        grupo.conflictos.forEach(c => {
          camposHtml += `
            <div class="inconsistencia-campo-item ${c.estado === 'RESUELTO' ? 'resuelto' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="inconsistencia-campo-nombre">${etiquetaCampoConflicto(c.campo)}</span>
                ${c.estado === 'PENDIENTE' ? `
                  <button class="boton-principal" style="height: 32px; min-height: 32px; padding: 0 12px; font-size: 0.78rem; width: auto;" onclick="appAdmin.abrirModalConflicto(${c.id})">
                    <ion-icon name="options-outline"></ion-icon> Resolver
                  </button>
                ` : ''}
              </div>
              <div class="inconsistencia-comparativa">
                <div class="inconsistencia-val-actual">
                  <span style="font-size: 0.72rem; text-transform: uppercase; display: block; opacity: 0.8;">Dato Oficial:</span>
                  <strong>${c.valor_actual || '(Vacío)'}</strong>
                </div>
                <div class="inconsistencia-val-recibido">
                  <span style="font-size: 0.72rem; text-transform: uppercase; display: block; opacity: 0.8;">Dato Recibido:</span>
                  <strong>${c.valor_recibido || '(Vacío)'}</strong>
                </div>
              </div>
              ${c.estado === 'RESUELTO' ? `
                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--color-border); font-size: 0.8rem;">
                  <strong>Decisión:</strong> ${c.decision} (${c.valor_resuelto})
                  <div style="color: var(--color-text-muted); font-style: italic;">"${c.motivo}"</div>
                </div>
              ` : ''}
            </div>
          `;
        });

        const fechaStr = new Date(grupo.fecha_creacion).toLocaleString('es-CO');

        tarjeta.innerHTML = `
          <div class="inconsistencia-header">
            <div class="inconsistencia-persona-info">
              <div class="inconsistencia-persona-nombre">Documento: ${grupo.persona_documento}</div>
              ${grupo.persona_nombre ? `<div class="inconsistencia-persona-doc">${grupo.persona_nombre}</div>` : ''}
            </div>
            <span class="insignia ${badgeClass}">${badgeText}</span>
          </div>

          <div class="inconsistencia-campos-lista">
            ${camposHtml}
          </div>

          <div class="inconsistencia-meta">
            <div><strong>Encuestador:</strong> ${grupo.encuestador_nombre} (${grupo.origen})</div>
            <div><strong>Fecha:</strong> ${fechaStr}</div>
          </div>
        `;
        contenedor.appendChild(tarjeta);
      });

      renderizarPaginador(totalItems, itemsPorPagina, this.paginaConflictos, 'paginacion-conflictos', (nuevaPag) => {
        this.paginaConflictos = nuevaPag;
        this.cargarAdminInconsistencias();
        const listCont = document.getElementById('lista-conflictos-contenedor');
        if (listCont) listCont.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (e) {
      console.error('Error al renderizar inconsistencias:', e);
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
          <div class="estado-vacio">
            <div class="estado-vacio-icono"><ion-icon name="shield-checkmark-outline"></ion-icon></div>
            <div class="estado-vacio-titulo">Sin registros de auditoría</div>
            <div class="estado-vacio-desc">No se encontraron resoluciones de conflictos para los filtros seleccionados.</div>
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
   * Carga el resumen de reportes de conflictos
   */
  async cargarAdminReportes() {
    try {
      const metricas = await this.ejecutarFetch('/admin/conflictos/metricas');
      const div = document.getElementById('admin-reporte-general');
      div.innerHTML = `
        <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Conflictos Totales Detectados:</span>
          <strong>${metricas.pendientes + metricas.resueltos}</strong>
        </div>
        <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Conflictos Pendientes:</span>
          <strong style="color: var(--color-warning);">${metricas.pendientes}</strong>
        </div>
        <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
          <span>Conflictos Resueltos:</span>
          <strong style="color: var(--color-success);">${metricas.resueltos}</strong>
        </div>
        <div style="display:flex; justify-content: space-between;">
          <span>Tasa de Resolución:</span>
          <strong>${metricas.pendientes + metricas.resueltos > 0 ? Math.round((metricas.resueltos / (metricas.pendientes + metricas.resueltos)) * 100) : 100}%</strong>
        </div>
      `;
    } catch (e) {
      console.error('Error al cargar reportes admin:', e);
    }
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
      document.getElementById('conf-campo-nombre').textContent = data.conflicto.campo;
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

    contenedor.innerHTML = '<div style="text-align: center; padding: 12px; color: var(--color-text-muted);">Cargando sincronizaciones...</div>';

    try {
      const response = await adminController.ejecutarFetch(`/historial/sincronizaciones?pagina=${this.paginaReportes}&limite=10`);
      contenedor.innerHTML = '';

      let lista = response.datos || [];

      // Aplicar filtros
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
            <div class="estado-vacio-titulo">No se encontraron sincronizaciones</div>
            <div class="estado-vacio-desc">No hay registros de sincronización que coincidan con la búsqueda.</div>
          </div>
        `;
        renderizarPaginador(0, 10, 1, 'admin-paginacion-reportes-sync', () => {});
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
            <div><strong>Encuestador:</strong> ${s.nombre_usuario || 'N/A'}</div>
            <div style="margin-top: 4px; font-weight: 600; color: var(--color-text);">
              Nuevos: ${s.registros_nuevos} · Actualizados: ${s.registros_actualizados} · Errores: ${s.registros_error}
            </div>
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
      contenedor.innerHTML = '<div style="text-align: center; padding: 12px; color: var(--color-danger);">Error de carga.</div>';
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
    document.getElementById('admin-reportes-busqueda').value = '';
    document.getElementById('admin-reportes-fecha').value = '';
    this.terminoBusqueda = '';
    this.filtroFecha = '';
    this.paginaReportes = 1;
    this.cargarReportes();
  }

  async abrirDetalle(id) {
    const listSec = document.getElementById('admin-reportes-lotes-seccion');
    const detSec = document.getElementById('admin-reporte-detalle-seccion');
    const detCont = document.getElementById('admin-reporte-detalle-contenido');

    listSec.style.display = 'none';
    detSec.style.display = 'block';
    detCont.innerHTML = '<div style="text-align: center; padding: 12px;">Cargando detalles de sincronización...</div>';

    try {
      const data = await adminController.ejecutarFetch(`/historial/sincronizaciones/${id}`);
      const s = data.sincronizacion;
      const cambios = data.cambios || [];

      let cambiosHtml = '';
      if (cambios.length === 0) {
        cambiosHtml = '<p style="font-size: 0.9rem; color: var(--color-text-muted); font-style: italic;">Sin cambios detallados en esta sincronización.</p>';
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
            <div><strong>Encuestador:</strong> ${s.nombre_usuario || 'N/A'}</div>
            <div><strong>Duración:</strong> ${s.duracion_ms ? (s.duracion_ms / 1000).toFixed(2) + 's' : 'N/A'}</div>
            <div><strong>Total registros en lote:</strong> ${s.cantidad_registros}</div>
            <div style="margin-top: 8px; font-weight: 700; color: var(--color-text);">
              Nuevos: ${s.registros_nuevos} · Actualizados: ${s.registros_actualizados} · Errores: ${s.registros_error}
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="boton-principal" style="flex: 1;" onclick="appAdminReportes.descargarReporte(${s.id}, 'pdf')">
              <ion-icon name="download"></ion-icon> Descargar PDF
            </button>
            <button class="boton-secundario" style="flex: 1;" onclick="appAdminReportes.descargarReporte(${s.id}, 'txt')">
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
      console.error('Error al cargar detalle en admin:', e);
      detCont.innerHTML = '<div style="text-align: center; color: var(--color-danger);">Error de comunicación con la API.</div>';
    }
  }

  mostrarListaSincronizaciones() {
    document.getElementById('admin-reportes-lotes-seccion').style.display = 'block';
    document.getElementById('admin-reporte-detalle-seccion').style.display = 'none';
  }

  async descargarReporte(id, formato) {
    try {
      const token = localStorage.getItem('auth_token');
      const url = apiService.buildUrl(`/reportes/sincronizacion/${id}/${formato}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': '69420'
        }
      });
      
      if (!response.ok) throw new Error('Error al descargar el archivo');
      const blob = await response.blob();
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

export const adminController = new AdminController();
export const adminReportesController = new AdminReportesController();

