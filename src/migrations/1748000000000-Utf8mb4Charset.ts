import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures Unicode (Armenian / Russian / etc.) can be stored in all string columns.
 *
 * MySQL 8 may still error with ER_FK_COLUMN_CANNOT_CHANGE on CONVERT if FKs exist,
 * especially when this migration is wrapped in a transaction — so we drop FKs,
 * convert, then recreate them. `transaction = false` avoids DDL/transaction quirks.
 */
export class Utf8mb4Charset1748000000000 implements MigrationInterface {
  /** Do not wrap in START TRANSACTION — MySQL DDL + FK_CHECKS behaves badly inside it. */
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const db = queryRunner.connection.options.database;
    if (typeof db === 'string' && db.length > 0) {
      const safeDb = db.replace(/`/g, '``');
      await queryRunner.query(
        `ALTER DATABASE \`${safeDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }

    const tables = [
      'notifications',
      'auth_otps',
      'bookings',
      'rooms',
      'customers',
      'hotels',
      'users',
    ];

    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      // Same names as InitSchema1746697000000 — required for CONVERT on FK columns.
      await queryRunner.query(
        'ALTER TABLE `bookings` DROP FOREIGN KEY `FK_bookings_customerId_customers_id`',
      );
      await queryRunner.query(
        'ALTER TABLE `bookings` DROP FOREIGN KEY `FK_bookings_roomId_rooms_id`',
      );
      await queryRunner.query(
        'ALTER TABLE `rooms` DROP FOREIGN KEY `FK_rooms_hotelId_hotels_id`',
      );
      await queryRunner.query(
        'ALTER TABLE `customers` DROP FOREIGN KEY `FK_customers_ownerId_users_id`',
      );
      await queryRunner.query(
        'ALTER TABLE `hotels` DROP FOREIGN KEY `FK_hotels_ownerId_users_id`',
      );

      for (const table of tables) {
        const tableName = table.replace(/`/g, '``');
        await queryRunner.query(
          `ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
      }

      await queryRunner.query(
        'ALTER TABLE `hotels` ADD CONSTRAINT `FK_hotels_ownerId_users_id` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL',
      );
      await queryRunner.query(
        'ALTER TABLE `customers` ADD CONSTRAINT `FK_customers_ownerId_users_id` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE SET NULL',
      );
      await queryRunner.query(
        'ALTER TABLE `rooms` ADD CONSTRAINT `FK_rooms_hotelId_hotels_id` FOREIGN KEY (`hotelId`) REFERENCES `hotels`(`id`) ON DELETE CASCADE',
      );
      await queryRunner.query(
        'ALTER TABLE `bookings` ADD CONSTRAINT `FK_bookings_roomId_rooms_id` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE CASCADE',
      );
      await queryRunner.query(
        'ALTER TABLE `bookings` ADD CONSTRAINT `FK_bookings_customerId_customers_id` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE',
      );
    } finally {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  public async down(): Promise<void> {
    // Charset downgrade can corrupt non-ASCII data; intentionally left empty.
  }
}
