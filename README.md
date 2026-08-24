# Frontend — SGES (Sistema de Gestión de Encuestas de Salud)

Este módulo contiene la interfaz de usuario móvil y web de **SGES**. Está diseñado con un enfoque **Offline-First**, permitiendo a los encuestadores ingresar información demográfica y de salud sin conexión a internet y sincronizarla posteriormente con el servidor central.

---

## 🛠️ Tecnologías Utilizadas

*   **HTML5 & CSS3:** Estilos completamente personalizados sin frameworks CSS pesados.
*   **JavaScript (ES6 Modular):** Arquitectura limpia utilizando módulos nativos y controladores orientados a objetos.
*   **SQLite & sql.js:** Almacenamiento local SQLite encapsulado y sincronizable.
*   **Vite:** Servidor de desarrollo súper rápido y empaquetador eficiente de recursos.
*   **Capacitor:** Enlace nativo para exportación directa a dispositivos Android.

---

## 🚀 Comandos Útiles

Dentro de esta carpeta (`frontend`), puedes ejecutar:

### Entorno de Desarrollo Web
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (Vite)
npm run dev
```

### Compilación y Preparación para Dispositivos Móviles
```bash
# Construir archivos estáticos optimizados
npm run build

# Sincronizar el bundle construido con la aplicación nativa de Android
npx cap sync

# Abrir el entorno nativo en Android Studio
npx cap open android
```
