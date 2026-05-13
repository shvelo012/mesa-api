"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("restaurants", "smtpHost", { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await queryInterface.addColumn("restaurants", "smtpPort", { type: Sequelize.INTEGER, allowNull: true, defaultValue: null });
    await queryInterface.addColumn("restaurants", "smtpUser", { type: Sequelize.STRING, allowNull: true, defaultValue: null });
    await queryInterface.addColumn("restaurants", "smtpPass", { type: Sequelize.STRING, allowNull: true, defaultValue: null });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("restaurants", "smtpHost");
    await queryInterface.removeColumn("restaurants", "smtpPort");
    await queryInterface.removeColumn("restaurants", "smtpUser");
    await queryInterface.removeColumn("restaurants", "smtpPass");
  },
};
