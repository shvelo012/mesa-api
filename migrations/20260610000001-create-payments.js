'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      restaurantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'restaurants', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      planId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      subscriptionId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'subscriptions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      provider: { type: Sequelize.STRING, allowNull: false },
      providerOrderId: { type: Sequelize.STRING, allowNull: true },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      currency: { type: Sequelize.STRING, allowNull: false, defaultValue: 'GEL' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'PENDING' },
      kind: { type: Sequelize.STRING, allowNull: false, defaultValue: 'INITIAL' },
      rawCallback: { type: Sequelize.JSONB, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('payments', ['providerOrderId']);
    await queryInterface.addIndex('payments', ['restaurantId']);
    await queryInterface.addIndex('payments', ['status']);
    await queryInterface.addIndex('payments', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payments');
  },
};
