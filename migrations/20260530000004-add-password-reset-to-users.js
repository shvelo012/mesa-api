'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'passwordResetToken', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('users', 'passwordResetExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'passwordResetToken');
    await queryInterface.removeColumn('users', 'passwordResetExpiresAt');
  },
};
