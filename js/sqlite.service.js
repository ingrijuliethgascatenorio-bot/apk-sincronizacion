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

  async inicializar() {
    if (this.isInitialized) return this.db;

    try {
      return await this._intentarInicializar();
    } catch (error) {
      // Reintento único: si el plugin nativo respondió "null" es casi siempre
      // porque el puente de Capacitor todavía no estaba listo (carrera de
      // tiempos en el arranque de la app). Esperamos medio segundo y probamos
      // una vez más antes de rendirnos.
      const pareceProblemaDeTiempos =
        error?.message?.includes('null') || error?.message?.includes('CapacitorSQLitePlugin');

      if (pareceProblemaDeTiempos) {
        console.warn('⏳ SQLite no respondió al primer intento, reintentando en 500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
        return await this._intentarInicializar();
      }
      throw error;
    }
  }

  async _intentarInicializar() {
    try {
      this.sqliteConnection = new SQLiteConnection(this.sqlitePlugin);

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
      await this.migrarEsquema();

      this.isInitialized = true;
      console.log(`✅ Base de Datos Nativa SQLite '${this.dbName}' inicializada correctamente.`);
      return this.db;
    } catch (error) {
      console.error('❌ Error al inicializar SQLite nativo:', error);
      throw error;
    }
  }

  /**
   * Crea las tablas locales necesarias en SQLite (instalación nueva)
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
        eps_otro_nombre TEXT,
        telefono1 TEXT,
        telefono2 TEXT,
        telefono3 TEXT,
        correo TEXT,
        estrato TEXT,
        estado_civil TEXT,
        barrio TEXT,
        direccion TEXT,
        estado_registro TEXT DEFAULT 'ACTIVO',
        estado_sincronizacion TEXT DEFAULT 'PENDING_INSERT',
        fecha_creacion TEXT NOT NULL,
        fecha_actualizacion TEXT NOT NULL,
        version_persona INTEGER DEFAULT 1,
        version_base INTEGER DEFAULT 1,
        version_local INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS SincronizacionLog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT NOT NULL,
        estado TEXT NOT NULL,
        cantidad_registros INTEGER DEFAULT 0,
        mensaje TEXT,
        registros_nuevos INTEGER DEFAULT 0,
        registros_actualizados INTEGER DEFAULT 0,
        registros_error INTEGER DEFAULT 0,
        registros_conflictos INTEGER DEFAULT 0
      );
    `;

    await this.db.execute(ddlSQL);
  }

  /**
   * Para quien ya tenía la tabla Persona creada con el esquema viejo
   * (un solo campo `telefono`, sin correo/estrato/estado_civil/eps_otro_nombre):
   * agrega las columnas nuevas sin borrar los datos existentes.
   * SQLite no soporta "ADD COLUMN IF NOT EXISTS", así que se detecta con PRAGMA.
   */
  async migrarEsquema() {
    try {
      const columnas = await this.db.query('PRAGMA table_info(Persona);');
      const nombresColumnas = (columnas.values || []).map(c => c.name);

      const columnasNuevas = [
        { nombre: 'eps_otro_nombre', ddl: 'ALTER TABLE Persona ADD COLUMN eps_otro_nombre TEXT;' },
        { nombre: 'telefono1', ddl: 'ALTER TABLE Persona ADD COLUMN telefono1 TEXT;' },
        { nombre: 'telefono2', ddl: 'ALTER TABLE Persona ADD COLUMN telefono2 TEXT;' },
        { nombre: 'telefono3', ddl: 'ALTER TABLE Persona ADD COLUMN telefono3 TEXT;' },
        { nombre: 'correo', ddl: 'ALTER TABLE Persona ADD COLUMN correo TEXT;' },
        { nombre: 'estrato', ddl: 'ALTER TABLE Persona ADD COLUMN estrato TEXT;' },
        { nombre: 'estado_civil', ddl: 'ALTER TABLE Persona ADD COLUMN estado_civil TEXT;' },
        { nombre: 'version_persona', ddl: 'ALTER TABLE Persona ADD COLUMN version_persona INTEGER DEFAULT 1;' },
        { nombre: 'version_base', ddl: 'ALTER TABLE Persona ADD COLUMN version_base INTEGER DEFAULT 1;' },
      ];

      for (const col of columnasNuevas) {
        if (!nombresColumnas.includes(col.nombre)) {
          await this.db.execute(col.ddl);
          console.log(`[DB] Columna agregada por migración: ${col.nombre}`);
        }
      }

      // Migración de SincronizacionLog: agrega el desglose (nuevos, actualizados,
      // errores, inconsistencias) para instalaciones que ya tenían la tabla vieja
      // sin estas columnas — necesario para el timeline de Historial.
      const columnasLog = await this.db.query('PRAGMA table_info(SincronizacionLog);');
      const nombresColumnasLog = (columnasLog.values || []).map(c => c.name);
      const columnasLogNuevas = [
        { nombre: 'registros_nuevos', ddl: 'ALTER TABLE SincronizacionLog ADD COLUMN registros_nuevos INTEGER DEFAULT 0;' },
        { nombre: 'registros_actualizados', ddl: 'ALTER TABLE SincronizacionLog ADD COLUMN registros_actualizados INTEGER DEFAULT 0;' },
        { nombre: 'registros_error', ddl: 'ALTER TABLE SincronizacionLog ADD COLUMN registros_error INTEGER DEFAULT 0;' },
        { nombre: 'registros_conflictos', ddl: 'ALTER TABLE SincronizacionLog ADD COLUMN registros_conflictos INTEGER DEFAULT 0;' },
      ];
      for (const col of columnasLogNuevas) {
        if (!nombresColumnasLog.includes(col.nombre)) {
          await this.db.execute(col.ddl);
          console.log(`[DB] Columna agregada por migración: ${col.nombre}`);
        }
      }

      // Si existía la columna vieja `telefono` (singular) y telefono1 quedó vacío,
      // migramos el dato para no perder los teléfonos ya guardados.
      if (nombresColumnas.includes('telefono')) {
        await this.db.execute(
          "UPDATE Persona SET telefono1 = telefono WHERE (telefono1 IS NULL OR telefono1 = '') AND telefono IS NOT NULL;"
        );
      }
    } catch (e) {
      console.warn('[DB] Migración de esquema: nada que migrar o error menor:', e);
    }
  }

  /**
   * Ejecuta cualquier operación de SQLite (query o run) con un reintento
   * automático si el plugin nativo responde "null". Esto puede pasar no
   * solo al arrancar la app, sino también más adelante si Android pausó
   * el WebView un instante (por ejemplo al cambiar de pantalla) y la
   * conexión quedó inválida aunque `isInitialized` siga en true.
   */
  async _conReintento(operacion) {
    await this.inicializar();
    try {
      return await operacion();
    } catch (error) {
      const pareceProblemaDeTiempos =
        error?.message?.includes('null') || error?.message?.includes('CapacitorSQLitePlugin');

      if (!pareceProblemaDeTiempos) {
        throw error;
      }

      console.warn('⏳ Llamada a SQLite falló ("null"), forzando reconexión y reintentando...');
      this.isInitialized = false; // fuerza a que inicializar() vuelva a conectar de verdad
      await new Promise(resolve => setTimeout(resolve, 400));
      await this.inicializar();
      return await operacion(); // si falla de nuevo, el error sí se propaga
    }
  }

  async query(statement, values = []) {
    const res = await this._conReintento(() => this.db.query(statement, values));
    return res.values || [];
  }

  async run(statement, values = []) {
    return await this._conReintento(() => this.db.run(statement, values));
  }

  async guardarPersistencia() {
    // En Android/iOS nativo, @capacitor-community/sqlite ya persiste a disco
    // en cada `run()`. Este método existe para paridad con el modo web
    // (donde sí hace falta guardar explícitamente en IndexedDB).
    try {
      if (this.sqliteConnection && typeof this.sqliteConnection.saveToStore === 'function') {
        await this.sqliteConnection.saveToStore(this.dbName);
      }
    } catch (e) {
      // No crítico en nativo; solo aplica en plataforma web.
    }
  }
}

export const sqliteService = new SqliteService();