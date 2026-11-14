import { Sequelize } from 'sequelize';

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'bakachiki',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    define: { underscored: true, timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' },
    pool: { max: 10, min: 0, idle: 10000 },
  },
);
