import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures Unicode ( Armenia / Russian / etc. ) can be stored in all string columns.
 * Safe to run if the DB is already utf8mb4 (MySQL is effectively a no-op for data).
 */
export class Utf8mb4Charset1748000000000 implements MigrationInterface {
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

    // CONVERT touches FK columns; MySQL rejects that unless checks are off temporarily.
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const table of tables) {
        const tableName = table.replace(/`/g, '``');
        await queryRunner.query(
          `ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        );
      }
    } finally {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  public async down(): Promise<void> {
    // Charset downgrade can corrupt non-ASCII data; intentionally left empty.
  }
}
