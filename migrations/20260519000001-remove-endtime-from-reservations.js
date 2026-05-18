'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tableDesc = await queryInterface.describeTable('reservations');
    if (tableDesc.endTime) {
      await queryInterface.removeColumn('reservations', 'endTime');
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('reservations', 'endTime', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
