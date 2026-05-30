'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');
    if (!table.passwordResetToken) {
      await queryInterface.addColumn('users', 'passwordResetToken', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!table.passwordResetExpiresAt) {
      await queryInterface.addColumn('users', 'passwordResetExpiresAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'passwordResetToken');
    await queryInterface.removeColumn('users', 'passwordResetExpiresAt');
  },
};
