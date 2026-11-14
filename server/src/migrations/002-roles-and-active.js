// Adds the super_admin role and an is_active flag (deactivated users can't sign in or use old tokens).
import { DataTypes as T } from 'sequelize';

export async function up({ context: qi }) {
  await qi.changeColumn('users', 'role', { type: T.ENUM('customer', 'admin', 'super_admin'), allowNull: false, defaultValue: 'customer' });
  await qi.addColumn('users', 'is_active', { type: T.BOOLEAN, allowNull: false, defaultValue: true });
  await qi.addIndex('users', ['role']);
}

export async function down({ context: qi }) {
  await qi.removeIndex('users', ['role']);
  await qi.removeColumn('users', 'is_active');
  await qi.sequelize.query("UPDATE users SET role = 'admin' WHERE role = 'super_admin'");
  await qi.changeColumn('users', 'role', { type: T.ENUM('customer', 'admin'), allowNull: false, defaultValue: 'customer' });
}
