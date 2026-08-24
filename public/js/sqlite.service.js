/**
 * SERVICIO SQLITE NATIVO EXCLUSIVO (JS ES6)
 * Utiliza @capacitor-community/sqlite directamente en Android e iOS.
 * Base de Datos Nativa: salud_encuestas
 */

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { CONFIG } from './config.js';

class SqliteService {
  constructor() {
    this.sqlitePlugin = CapacitorSQLite;
    this.sqliteConnection = null;
    this.db = null;
    this.dbName = CONFIG.DB_NAME || 'salud_encuestas';
    this.isInitialized = false;
  }

  /**
   * Inicializa la conexión SQLite nativa y crea el esquema de tablas en Android e iOS.
   */
  async inicializar() {
    if (this.isInitialized) return this.db;

    try {
      this.sqliteConnection = new SQLiteConnection(this.sqlitePlugin);

      // Comprobar si ya existe una conexión activa
      const isConn = await this.sqliteConnection.isConnection(this.dbName, false);
      if (isConn.result) {
        this.db = await this.sqliteConnection.retrieveConnection(this.dbName, false);
      } else {
        this.db = await this.sqliteConnection.createConnection(
          this.dbName,
          false,
          'no-encryption',
          1,
          false
        );
      }

      await this.db.open();
      await this.crearEsquemaTablas();

      this.isInitialized = true;
      console.log(`✅ Base de Datos Nativa SQLite '${this.dbName}' inicializada correctamente.`);
      return this.db;
    } catch (error) {
      console.error('❌ Error al inicializar SQLite nativo:', error);
      throw error;
    }
  }

  /**
   * Crea las tablas locales necesarias en SQLite
   */
  async crearEsquemaTablas() {
    const ddlSQL = `
      CREATE TABLE IF NOT EXISTS Persona (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        id_remoto TEXT UNIQUE,
        nombres TEXT NOT NULL,
        apellidos TEXT NOT NULL,
        id_tipo_documento INTEGER NOT NULL,
        numero_documento TEXT NOT NULL UNIQUE,
        fecha_nacimiento TEXT NOT NULL,
        genero TEXT NOT NULL,
        id_eps INTEGER NOT NULL,
        telefono TEXT,
        barrio TEXT,
        direccion TEXT,
        estado_registro TEXT DEFAULT 'ACTIVO',
        estado_sincronizacion TEXT DEFAULT 'PENDING_INSERT',
        fecha_creacion TEXT NOT NULL,
        fecha_actualizacion TEXT NOT NULL,
        version_local INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS SincronizacionLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT NOT NULL,
        estado TEXT NOT NULL,
        cantidad_registros INTEGER DEFAULT 0,
        mensaje TEXT
      );
    `;

    await this.db.execute(ddlSQL);
  }

  /**
   * Ejecuta una consulta SELECT
   */
  async query(statement, values = []) {
    await this.inicializar();
    const res = await this.db.query(statement, values);
    return res.values || [];
  }

  /**
   * Ejecuta una sentencia INSERT, UPDATE o DELETE
   */
  async run(statement, values = []) {
    await this.inicializar();
    return await this.db.run(statement, values);
  }
}

export const sqliteService = new SqliteService();
