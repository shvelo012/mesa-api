'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plan_features', {
      planId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
        onDelete: 'CASCADE',
      },
      featureId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'features', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('plan_features', {
      fields: ['planId', 'featureId'],
      type: 'unique',
      name: 'plan_features_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plan_features', { cascade: true });
  },
};
