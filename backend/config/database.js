const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')

const sslEnabled = String(process.env.MYSQL_SSL || 'true').toLowerCase() !== 'false'

let pool = null
let mockMode = false
const mockUsers = []

function isMockMode() {
  return mockMode
}

try {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'vision_iq',
    ...(sslEnabled ? { ssl: { rejectUnauthorized: false } } : {}),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 5000,
  })
} catch {
  pool = null
}

async function initializeDatabase() {
  const adminUsers = [
    {
      username: process.env.ADMIN1_USERNAME,
      email: process.env.ADMIN1_EMAIL,
      password: process.env.ADMIN1_PASSWORD,
    },
    {
      username: process.env.ADMIN2_USERNAME,
      email: process.env.ADMIN2_EMAIL,
      password: process.env.ADMIN2_PASSWORD,
    },
  ].filter((u) => u.username && u.email && u.password)

  try {
    if (!pool) throw new Error('MySQL connection pool could not be created')

    // Quick probe connection
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()

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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS toll_rates (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        vehicle_class VARCHAR(80) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'INR',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY toll_rate_vehicle_class (vehicle_class)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    const defaultTollRates = [
      ['Car', 135],
      ['SUV', 135],
      ['Bus', 280],
      ['Truck', 410],
      ['Auto', 80],
      ['LCV', 210],
      ['Default', 135],
    ]
    await pool.query(
      'INSERT IGNORE INTO toll_rates (vehicle_class, amount) VALUES ?',
      [defaultTollRates],
    )

    // Auto-sync admin users into MySQL so logins never fail with "invalid password"
    for (const admin of adminUsers) {
      const email = admin.email.trim().toLowerCase()
      const [existing] = await pool.execute('SELECT id, password FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email])
      if (existing.length === 0) {
        const hashedPassword = await bcrypt.hash(admin.password, 12)
        await pool.execute(
          'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
          [admin.username.trim(), email, hashedPassword, 'admin']
        )
        console.log(`[Database] Auto-seeded admin user: ${admin.username} (${email})`)
      } else {
        // Verify password match with .env; if different, sync it
        const matches = await bcrypt.compare(admin.password, existing[0].password)
        if (!matches) {
          const hashedPassword = await bcrypt.hash(admin.password, 12)
          await pool.execute(
            'UPDATE users SET username = ?, password = ? WHERE id = ?',
            [admin.username.trim(), hashedPassword, existing[0].id]
          )
          console.log(`[Database] Synchronized updated password for ${admin.username} (${email}) from .env`)
        }
      }
    }

    mockMode = false
    return { connected: true, mock: false }
  } catch (err) {
    mockMode = true
    console.warn(`\n[Database Notice] Could not connect to MySQL at ${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306} (${err.code || err.message}).`)
    console.warn(`[Database Notice] Running in offline in-memory mode so the API server starts without crashing.\n`)

    mockUsers.length = 0
    for (const u of adminUsers) {
      const hashedPassword = await bcrypt.hash(u.password, 10)
      mockUsers.push({
        id: mockUsers.length + 1,
        username: u.username.trim(),
        email: u.email.trim().toLowerCase(),
        password: hashedPassword,
        role: 'admin',
      })
    }

    return { connected: false, mock: true, error: err }
  }
}

module.exports = { pool, initializeDatabase, isMockMode, mockUsers }