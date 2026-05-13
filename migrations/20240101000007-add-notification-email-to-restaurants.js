"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("restaurants", "notificationEmail", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("restaurants", "notificationEmail");
  },
};
