// Usage: node src/migrate.js up | down
import { Umzug, SequelizeStorage } from 'umzug';
import { pathToFileURL } from 'node:url';
import { sequelize } from './db.js';

export const umzug = new Umzug({
  migrations: {
    glob: ['migrations/*.js', { cwd: import.meta.dirname }],
    resolve: ({ name, path, context }) => ({
      name,
      up: async () => (await import(pathToFileURL(path).href)).up({ context }),
      down: async () => (await import(pathToFileURL(path).href)).down({ context }),
    }),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'migrations_meta' }),
  logger: console,
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cmd = process.argv[2] || 'up';
  await (cmd === 'down' ? umzug.down() : umzug.up());
  await sequelize.close();
}
