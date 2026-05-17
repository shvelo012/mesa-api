'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('floors', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sectionType: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'INDOOR',
      },
      width: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 800,
      },
      height: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 600,
      },
      bgColor: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '#f5f5f0',
      },
      restaurantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'restaurants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('floors');
  },
};
