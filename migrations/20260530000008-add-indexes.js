'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(
      'reservations',
      ['tableId', 'date', 'status'],
      { name: 'reservations_tableId_date_status' },
    );
    await queryInterface.addIndex(
      'reservations',
      ['userId'],
      { name: 'reservations_userId' },
    );
    await queryInterface.addIndex(
      'restaurant_staff',
      ['userId', 'restaurantId'],
      { name: 'restaurant_staff_userId_restaurantId' },
    );
    await queryInterface.addIndex(
      'subscriptions',
      ['restaurantId', 'status'],
      { name: 'subscriptions_restaurantId_status' },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('reservations', 'reservations_tableId_date_status');
    await queryInterface.removeIndex('reservations', 'reservations_userId');
    await queryInterface.removeIndex('restaurant_staff', 'restaurant_staff_userId_restaurantId');
    await queryInterface.removeIndex('subscriptions', 'subscriptions_restaurantId_status');
  },
};
