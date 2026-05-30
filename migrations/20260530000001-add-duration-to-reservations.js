'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reservations', 'duration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 90,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reservations', 'duration');
  },
};
