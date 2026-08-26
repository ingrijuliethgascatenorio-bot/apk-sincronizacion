export const CONFIG = {
  // URL del Backend expuesto por túnel ngrok
  // El backend usa app.setGlobalPrefix('api'), por eso la URL termina en /api
  API_URL: "https://saludata-api.julieth.site/api",
  APP_NAME: "SaluData",
  // OJO: sin extensión ".db" — el plugin @capacitor-community/sqlite la agrega
  // internamente. Ponerla aquí también puede causar que busque la conexión
  // con un nombre distinto al que realmente creó (síntoma: "CapacitorSQLitePlugin: null").
  DB_NAME: "salud_offline"
};