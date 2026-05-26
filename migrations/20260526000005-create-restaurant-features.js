'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('restaurant_features', {
      restaurantId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'restaurants', key: 'id' },
        onDelete: 'CASCADE',
      },
      featureId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'features', key: 'id' },
        onDelete: 'CASCADE',
      },
      grantedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('restaurant_features', {
      fields: ['restaurantId', 'featureId'],
      type: 'unique',
      name: 'restaurant_features_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('restaurant_features', { cascade: true });
  },
};
