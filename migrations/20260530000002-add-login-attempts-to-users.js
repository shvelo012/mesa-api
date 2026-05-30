'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'loginAttempts', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('users', 'lockedUntil', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'loginAttempts');
    await queryInterface.removeColumn('users', 'lockedUntil');
  },
};
