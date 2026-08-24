/**
 * UTILIDADES COMPARTIDAS DE INTERFAZ (JS ES6)
 * Funciones de renderizado usadas tanto por el flujo de Encuestador (app.js)
 * como por el panel de Administrador (admin.js), para no duplicar código
 * entre los dos archivos.
 */

/**
 * Traduce el nombre técnico de un campo en conflicto a una etiqueta legible.
 */
export function etiquetaCampoConflicto(campo) {
  if (campo === 'IDENTIDAD_DUPLICADA') return 'Documento duplicado (posibles personas distintas)';
  return campo;
}

/**
 * Dibuja los controles de paginación (info + botones) dentro de un contenedor.
 */
export function renderizarPaginador(totalItems, itemsPorPagina, paginaActual, contenedorId, cambiarPaginaCallback) {
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) return;
  contenedor.innerHTML = '';

  const totalPaginas = Math.ceil(totalItems / itemsPorPagina);

  if (totalItems <= itemsPorPagina || totalPaginas <= 1) {
    contenedor.style.display = 'none';
    return;
  }
  contenedor.style.display = 'flex';

  const divInfo = document.createElement('div');
  divInfo.className = 'paginacion-info';
  const inicioIdx = (paginaActual - 1) * itemsPorPagina + 1;
  const finIdx = Math.min(paginaActual * itemsPorPagina, totalItems);
  divInfo.textContent = `Mostrando ${inicioIdx}–${finIdx} de ${totalItems} registro(s)`;
  contenedor.appendChild(divInfo);

  const divBotones = document.createElement('div');
  divBotones.className = 'paginacion-botones';

  const btnAnt = document.createElement('button');
  btnAnt.className = `boton-pag ${paginaActual === 1 ? 'disabled' : ''}`;
  btnAnt.innerHTML = '<ion-icon name="chevron-back-outline"></ion-icon>';
  btnAnt.onclick = () => {
    if (paginaActual > 1) cambiarPaginaCallback(paginaActual - 1);
  };
  divBotones.appendChild(btnAnt);

  const rangoMax = 1;
  let paginas = [];

  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || (i >= paginaActual - rangoMax && i <= paginaActual + rangoMax)) {
      paginas.push(i);
    } else if (paginas[paginas.length - 1] !== '...') {
      paginas.push('...');
    }
  }

  paginas.forEach(pag => {
    const btn = document.createElement('button');
    if (pag === '...') {
      btn.className = 'boton-pag elipsis';
      btn.textContent = '...';
    } else {
      btn.className = `boton-pag ${pag === paginaActual ? 'activo' : ''}`;
      btn.textContent = pag;
      btn.onclick = () => cambiarPaginaCallback(pag);
    }
    divBotones.appendChild(btn);
  });

  const btnSig = document.createElement('button');
  btnSig.className = `boton-pag ${paginaActual === totalPaginas ? 'disabled' : ''}`;
  btnSig.innerHTML = '<ion-icon name="chevron-forward-outline"></ion-icon>';
  btnSig.onclick = () => {
    if (paginaActual < totalPaginas) cambiarPaginaCallback(paginaActual + 1);
  };
  divBotones.appendChild(btnSig);

  contenedor.appendChild(divBotones);
}
