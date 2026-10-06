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
      CREATE TABLE IF NOT EXISTS network_corridors (
        corridor_id VARCHAR(64) NOT NULL,
        corridor_name VARCHAR(180) NOT NULL,
        route VARCHAR(180) NULL,
        length_km DECIMAL(8,2) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        PRIMARY KEY (corridor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_zones (
        zone_id VARCHAR(64) NOT NULL,
        corridor_id VARCHAR(64) NOT NULL,
        zone_name VARCHAR(180) NOT NULL,
        km_marker DECIMAL(8,2) NULL,
        latitude DECIMAL(12,7) NULL,
        longitude DECIMAL(12,7) NULL,
        PRIMARY KEY (zone_id),
        KEY network_zones_corridor (corridor_id),
        CONSTRAINT network_zones_corridor_fk FOREIGN KEY (corridor_id) REFERENCES network_corridors (corridor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_road_segments (
        road_segment_id VARCHAR(64) NOT NULL,
        zone_id VARCHAR(64) NOT NULL,
        segment_name VARCHAR(180) NOT NULL,
        km_start DECIMAL(8,2) NULL,
        km_end DECIMAL(8,2) NULL,
        lanes TINYINT UNSIGNED NULL,
        speed_limit_kmh SMALLINT UNSIGNED NULL,
        PRIMARY KEY (road_segment_id),
        KEY network_segments_zone (zone_id),
        CONSTRAINT network_segments_zone_fk FOREIGN KEY (zone_id) REFERENCES network_zones (zone_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_cameras (
        camera_id VARCHAR(80) NOT NULL,
        zone_id VARCHAR(64) NOT NULL,
        camera_name VARCHAR(180) NOT NULL,
        latitude DECIMAL(12,7) NULL,
        longitude DECIMAL(12,7) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Active',
        PRIMARY KEY (camera_id),
        KEY network_cameras_zone (zone_id),
        CONSTRAINT network_cameras_zone_fk FOREIGN KEY (zone_id) REFERENCES network_zones (zone_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_vehicles (
        vehicle_id VARCHAR(64) NOT NULL,
        plate_number VARCHAR(80) NOT NULL,
        plate_is_synthetic VARCHAR(10) NOT NULL DEFAULT 'Yes',
        vehicle_type VARCHAR(80) NULL,
        vehicle_color VARCHAR(100) NULL,
        PRIMARY KEY (vehicle_id),
        UNIQUE KEY network_vehicles_plate (plate_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_incidents (
        incident_id VARCHAR(64) NOT NULL,
        incident_type VARCHAR(160) NOT NULL,
        occurred_at_ist DATETIME NOT NULL,
        corridor_id VARCHAR(64) NOT NULL,
        zone_id VARCHAR(64) NOT NULL,
        road_segment_id VARCHAR(64) NOT NULL,
        camera_id VARCHAR(80) NOT NULL,
        latitude DECIMAL(12,7) NULL,
        longitude DECIMAL(12,7) NULL,
        severity VARCHAR(24) NOT NULL,
        status VARCHAR(40) NOT NULL,
        lanes_blocked TINYINT UNSIGNED NOT NULL DEFAULT 0,
        description TEXT NULL,
        PRIMARY KEY (incident_id),
        KEY network_incidents_time (occurred_at_ist),
        KEY network_incidents_severity (severity),
        CONSTRAINT network_incidents_corridor_fk FOREIGN KEY (corridor_id) REFERENCES network_corridors (corridor_id),
        CONSTRAINT network_incidents_zone_fk FOREIGN KEY (zone_id) REFERENCES network_zones (zone_id),
        CONSTRAINT network_incidents_segment_fk FOREIGN KEY (road_segment_id) REFERENCES network_road_segments (road_segment_id),
        CONSTRAINT network_incidents_camera_fk FOREIGN KEY (camera_id) REFERENCES network_cameras (camera_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_incident_vehicles (
        incident_id VARCHAR(64) NOT NULL,
        vehicle_id VARCHAR(64) NOT NULL,
        plate_number VARCHAR(80) NOT NULL,
        vehicle_type VARCHAR(80) NULL,
        involvement_role VARCHAR(100) NULL,
        plate_confidence DECIMAL(6,4) NULL,
        detected_at_ist DATETIME NULL,
        evidence_reference VARCHAR(180) NULL,
        PRIMARY KEY (incident_id, vehicle_id),
        KEY network_incident_vehicles_plate (plate_number),
        CONSTRAINT network_incident_vehicles_incident_fk FOREIGN KEY (incident_id) REFERENCES network_incidents (incident_id) ON DELETE CASCADE,
        CONSTRAINT network_incident_vehicles_vehicle_fk FOREIGN KEY (vehicle_id) REFERENCES network_vehicles (vehicle_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_impact_analysis (
        impact_id VARCHAR(64) NOT NULL,
        incident_id VARCHAR(64) NOT NULL,
        road_segment_id VARCHAR(64) NOT NULL,
        estimated_delay_min SMALLINT UNSIGNED NULL,
        max_queue_km DECIMAL(8,2) NULL,
        traffic_flow_reduction_pct DECIMAL(5,2) NULL,
        affected_lanes TINYINT UNSIGNED NULL,
        estimated_clearance_min SMALLINT UNSIGNED NULL,
        diversion_recommended VARCHAR(10) NULL,
        PRIMARY KEY (impact_id),
        UNIQUE KEY network_impact_incident (incident_id),
        CONSTRAINT network_impact_incident_fk FOREIGN KEY (incident_id) REFERENCES network_incidents (incident_id) ON DELETE CASCADE,
        CONSTRAINT network_impact_segment_fk FOREIGN KEY (road_segment_id) REFERENCES network_road_segments (road_segment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_traffic_flow (
        observation_id VARCHAR(64) NOT NULL,
        observed_at_ist DATETIME NOT NULL,
        road_segment_id VARCHAR(64) NOT NULL,
        camera_id VARCHAR(80) NOT NULL,
        vehicles_per_5_min SMALLINT UNSIGNED NULL,
        average_speed_kmh DECIMAL(8,2) NULL,
        occupancy_pct DECIMAL(5,2) NULL,
        flow_state VARCHAR(40) NULL,
        PRIMARY KEY (observation_id),
        KEY network_flow_time_segment (observed_at_ist, road_segment_id),
        CONSTRAINT network_flow_segment_fk FOREIGN KEY (road_segment_id) REFERENCES network_road_segments (road_segment_id),
        CONSTRAINT network_flow_camera_fk FOREIGN KEY (camera_id) REFERENCES network_cameras (camera_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_risk_profiles (
        risk_profile_id VARCHAR(64) NOT NULL,
        incident_id VARCHAR(64) NOT NULL,
        road_segment_id VARCHAR(64) NOT NULL,
        risk_score_0_100 TINYINT UNSIGNED NOT NULL,
        risk_category VARCHAR(24) NOT NULL,
        contributing_factors TEXT NULL,
        recommended_action TEXT NULL,
        assessed_at_ist DATETIME NULL,
        PRIMARY KEY (risk_profile_id),
        UNIQUE KEY network_risk_incident (incident_id),
        CONSTRAINT network_risk_incident_fk FOREIGN KEY (incident_id) REFERENCES network_incidents (incident_id) ON DELETE CASCADE,
        CONSTRAINT network_risk_segment_fk FOREIGN KEY (road_segment_id) REFERENCES network_road_segments (road_segment_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS network_knowledge_graph_edges (
        graph_edge_id VARCHAR(64) NOT NULL,
        source_type VARCHAR(40) NOT NULL,
        source_id VARCHAR(100) NOT NULL,
        relationship VARCHAR(60) NOT NULL,
        target_type VARCHAR(40) NOT NULL,
        target_id VARCHAR(100) NOT NULL,
        PRIMARY KEY (graph_edge_id),
        KEY network_graph_source (source_type, source_id),
        KEY network_graph_target (target_type, target_id)
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