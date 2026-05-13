'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tables', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      shape: {
        type: Sequelize.ENUM('RECTANGLE', 'CIRCLE', 'SQUARE'),
        allowNull: false,
        defaultValue: 'RECTANGLE',
      },
      x: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      y: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      width: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 80,
      },
      height: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 80,
      },
      rotation: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      capacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      minCapacity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      isWindowSeat: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      imageUrl: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.dropTable('tables');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_tables_shape";');
  },
};
