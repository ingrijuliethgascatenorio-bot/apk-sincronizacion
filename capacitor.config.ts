import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sges.saludata',
  appName: 'SaluData',
  webDir: 'dist',
  server: {
    // Por defecto Capacitor sirve la app como si fuera "https://localhost",
    // lo que hace que el WebView bloquee como "contenido mixto" cualquier
    // fetch() hacia tu backend en http:// (sin cifrar), aunque el manifest
    // ya permita tráfico HTTP. Con androidScheme: 'http' la app se sirve
    // también como http://localhost, y deja de considerarse mixto.
    androidScheme: 'http'
  },
  plugins: {
    CapacitorSQLite: {
      // El plugin por defecto asume que vas a usar encriptación (isEncryption=true
      // en su propio código) e intenta inicializar el Keystore/biometría de Android
      // apenas arranca la app — antes de que tu código pida cualquier conexión.
      // Si eso falla en el dispositivo, TODO el plugin queda marcado como caído
      // para el resto de la sesión, y por eso ni reintentar servía de nada
      // (síntoma: "CapacitorSQLitePlugin: null" desde el primer intento).
      // Como esta app no necesita bases de datos encriptadas, se desactiva
      // explícitamente para que nunca intente tocar el Keystore.
      androidIsEncryption: false
    }
  }
};

export default config;
