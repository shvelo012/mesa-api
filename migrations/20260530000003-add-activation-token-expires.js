'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('restaurant_staff', 'activationTokenExpiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('restaurant_staff', 'activationTokenExpiresAt');
  },
};
