/**
 * SGES SALUD - HOME/LANDING PAGE PÚBLICA JAVASCRIPT AISLADO (home.js)
 * Manejo interactivo exclusivo de la landing page.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Menú Móvil
  const btnMobileMenu = document.getElementById('btn-mobile-menu');
  const mobileNav = document.getElementById('mobile-nav');

  if (btnMobileMenu && mobileNav) {
    btnMobileMenu.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      const isOpen = mobileNav.classList.contains('open');
      btnMobileMenu.innerHTML = isOpen 
        ? '<ion-icon name="close-outline"></ion-icon>' 
        : '<ion-icon name="menu-outline"></ion-icon>';
    });

    // Cerrar menú al hacer clic en enlaces
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        btnMobileMenu.innerHTML = '<ion-icon name="menu-outline"></ion-icon>';
      });
    });
  }

  // Navegación suave scroll-behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Configuración del Enlace de Descarga APK real
  const btnDownloadApk = document.getElementById('btn-download-apk');
  if (btnDownloadApk) {
    btnDownloadApk.href = './downloads/SaluData.apk';
  }
});
