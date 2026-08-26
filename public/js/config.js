/**
 * CONFIGURACIÓN GLOBAL DEL FRONTEND NATIVO
 * Único archivo donde se especifica la URL base del Backend NestJS y la BD SQLite.
 * Si cambia la red Wi-Fi o la IP de tu PC, solo debes modificar la variable API_URL aquí.
 */

export const CONFIG = {
  // IP de la PC en la red local Wi-Fi escuchando en el puerto 3001
  API_URL: "https://saludata-api.julieth.site/api",
  APP_NAME: "SGES Salud",
  DB_NAME: "salud_encuestas"
};
