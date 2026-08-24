export const CONFIG = {
  // IP de la PC en la red local Wi-Fi escuchando en el puerto 3001
  // El backend usa app.setGlobalPrefix('api'), por eso la URL termina en /api
  API_URL: "https://saludata-api.julieth.site/api",
  APP_NAME: "SGES Salud Nativo",
  // OJO: sin extensión ".db" — el plugin @capacitor-community/sqlite la agrega
  // internamente. Ponerla aquí también puede causar que busque la conexión
  // con un nombre distinto al que realmente creó (síntoma: "CapacitorSQLitePlugin: null").
  DB_NAME: "salud_offline"
};