const mysql = require('mysql2/promise')

const sslEnabled = String(process.env.MYSQL_SSL || 'true').toLowerCase() !== 'false'

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'vision_iq',
  ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(30) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      csv_record_id VARCHAR(120) NOT NULL,
      timestamp_ist VARCHAR(80) NULL,
      vehicle_type VARCHAR(80) NULL,
      vehicle_number_plate VARCHAR(80) NULL,
      plate_confidence DECIMAL(6,4) NULL,
      vehicle_image TEXT NULL,
      speed DECIMAL(10,2) NULL,
      speed_limit DECIMAL(10,2) NULL,
      over_speed VARCHAR(20) NULL,
      latitude DECIMAL(12,7) NULL,
      longitude DECIMAL(12,7) NULL,
      video_clip_path TEXT NULL,
      vehicle_image_path TEXT NULL,
      plate_image_path TEXT NULL,
      events VARCHAR(255) NULL,
      source_file VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY vehicle_event_source_record (source_file, csv_record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

module.exports = { pool, initializeDatabase }