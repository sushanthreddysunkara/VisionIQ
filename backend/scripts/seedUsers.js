require('dotenv').config()

const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { initializeDatabase, pool } = require('../config/database')

const users = [
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
]

async function seedUsers() {
  if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_DATABASE) {
    throw new Error('MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE must be set in backend/.env')
  }
  if (users.some((user) => !user.username || !user.email || !user.password)) {
    throw new Error('Both admin user credentials must be set in backend/.env')
  }

  await initializeDatabase()

  for (const user of users) {
    const password = await bcrypt.hash(user.password, 12)
    await User.upsertByEmail({ ...user, password, role: 'admin' })
    console.log(`Seeded ${user.username} (${user.email})`)
  }

  console.log('User seed complete. Re-running this command updates these two users without duplicates.')
}

seedUsers()
  .catch((error) => {
    console.error('Unable to seed users:', error.code || error.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
