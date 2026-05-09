import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserPreferences1746865000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'preferredLanguage',
        type: 'varchar',
        length: '8',
        isNullable: false,
        default: "'hy'",
      }),
      new TableColumn({
        name: 'preferredTheme',
        type: 'varchar',
        length: '10',
        isNullable: false,
        default: "'light'",
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'preferredTheme');
    await queryRunner.dropColumn('users', 'preferredLanguage');
  }
}
