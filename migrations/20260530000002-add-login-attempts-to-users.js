'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.loginAttempts) {
      await queryInterface.addColumn('users', 'loginAttempts', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!table.lockedUntil) {
      await queryInterface.addColumn('users', 'lockedUntil', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'loginAttempts');
    await queryInterface.removeColumn('users', 'lockedUntil');
  },
};
