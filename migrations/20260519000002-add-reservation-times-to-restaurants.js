"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable("restaurants");
    if (!tableDesc.reservationTimes) {
      await queryInterface.addColumn("restaurants", "reservationTimes", {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    }
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn("restaurants", "reservationTimes");
  },
};
