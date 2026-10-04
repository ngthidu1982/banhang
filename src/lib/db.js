import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'defaultdb',
  port: Number(process.env.DB_PORT) || 18697,
  ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' 
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});