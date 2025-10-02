'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'character_inventory', schema: 'dwd' },
      'equipped',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    );

    await queryInterface.sequelize.query(
      'UPDATE "dwd"."character_inventory" SET "equipped" = false WHERE "equipped" IS NULL;'
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      { tableName: 'character_inventory', schema: 'dwd' },
      'equipped'
    );
  }
};
