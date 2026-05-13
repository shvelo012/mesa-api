'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('walls', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      x1: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      y1: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      x2: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      y2: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      floorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'floors',
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
    await queryInterface.dropTable('walls');
  },
};
