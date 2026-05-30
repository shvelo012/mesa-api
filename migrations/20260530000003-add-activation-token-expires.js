'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('restaurant_staff');
    if (!table.activationTokenExpiresAt) {
      await queryInterface.addColumn('restaurant_staff', 'activationTokenExpiresAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null,
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('restaurant_staff', 'activationTokenExpiresAt');
  },
};
