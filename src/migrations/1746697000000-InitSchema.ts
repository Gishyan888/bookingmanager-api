import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class InitSchema1746697000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '120' },
          { name: 'email', type: 'varchar', length: '180' },
          { name: 'password', type: 'varchar' },
          {
            name: 'role',
            type: 'enum',
            enum: ['admin', 'owner', 'manager'],
            default: "'manager'",
          },
          { name: 'phone', type: 'varchar', length: '30', isNullable: true },
          { name: 'isActive', type: 'tinyint', width: 1, default: 1 },
          {
            name: 'assignedHotelId',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [{ name: 'IDX_users_email', columnNames: ['email'], isUnique: true }],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'hotels',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '160' },
          { name: 'location', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'rating', type: 'varchar', length: '6', default: "'4.5'" },
          { name: 'ownerId', type: 'varchar', length: '36', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'hotels',
      new TableForeignKey({
        name: 'FK_hotels_ownerId_users_id',
        columnNames: ['ownerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'customers',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', length: '160' },
          { name: 'email', type: 'varchar', length: '180', isNullable: true },
          { name: 'phone', type: 'varchar', length: '30', isNullable: true },
          { name: 'idDocument', type: 'varchar', length: '80', isNullable: true },
          { name: 'address', type: 'text', isNullable: true },
          { name: 'ownerId', type: 'varchar', length: '36', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'customers',
      new TableForeignKey({
        name: 'FK_customers_ownerId_users_id',
        columnNames: ['ownerId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'rooms',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'roomNumber', type: 'varchar', length: '32' },
          {
            name: 'type',
            type: 'enum',
            enum: ['single', 'double', 'suite', 'deluxe', 'family'],
            default: "'single'",
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['available', 'occupied', 'maintenance'],
            default: "'available'",
          },
          { name: 'capacity', type: 'int', default: 1 },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'hotelId', type: 'varchar', length: '36' },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'rooms',
      new TableForeignKey({
        name: 'FK_rooms_hotelId_hotels_id',
        columnNames: ['hotelId'],
        referencedTableName: 'hotels',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'bookings',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'roomId', type: 'varchar', length: '36' },
          { name: 'customerId', type: 'varchar', length: '36' },
          { name: 'checkIn', type: 'datetime' },
          { name: 'checkOut', type: 'datetime' },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'totalAmount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          { name: 'notes', type: 'text', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('bookings', [
      new TableForeignKey({
        name: 'FK_bookings_roomId_rooms_id',
        columnNames: ['roomId'],
        referencedTableName: 'rooms',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_bookings_customerId_customers_id',
        columnNames: ['customerId'],
        referencedTableName: 'customers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'auth_otps',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'varchar', length: '36' },
          { name: 'email', type: 'varchar', length: '180' },
          { name: 'purpose', type: 'varchar', length: '24' },
          { name: 'codeHash', type: 'varchar', length: '255' },
          { name: 'expiresAt', type: 'datetime' },
          { name: 'usedAt', type: 'datetime', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_auth_otps_userId_purpose_usedAt',
            columnNames: ['userId', 'purpose', 'usedAt'],
          },
          {
            name: 'IDX_auth_otps_email_purpose_usedAt',
            columnNames: ['email', 'purpose', 'usedAt'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'varchar', length: '36' },
          { name: 'type', type: 'varchar', length: '64' },
          { name: 'title', type: 'varchar', length: '220' },
          { name: 'body', type: 'text' },
          { name: 'metadata', type: 'json', isNullable: true },
          { name: 'readAt', type: 'datetime', isNullable: true },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndices('notifications', [
      new TableIndex({
        name: 'IDX_notifications_userId',
        columnNames: ['userId'],
      }),
      new TableIndex({
        name: 'IDX_notifications_userId_createdAt',
        columnNames: ['userId', 'createdAt'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notifications',
      'IDX_notifications_userId_createdAt',
    );
    await queryRunner.dropIndex('notifications', 'IDX_notifications_userId');
    await queryRunner.dropTable('notifications');

    await queryRunner.dropIndex(
      'auth_otps',
      'IDX_auth_otps_email_purpose_usedAt',
    );
    await queryRunner.dropIndex(
      'auth_otps',
      'IDX_auth_otps_userId_purpose_usedAt',
    );
    await queryRunner.dropTable('auth_otps');

    await queryRunner.dropForeignKey(
      'bookings',
      'FK_bookings_customerId_customers_id',
    );
    await queryRunner.dropForeignKey('bookings', 'FK_bookings_roomId_rooms_id');
    await queryRunner.dropTable('bookings');

    await queryRunner.dropForeignKey('rooms', 'FK_rooms_hotelId_hotels_id');
    await queryRunner.dropTable('rooms');

    await queryRunner.dropForeignKey('customers', 'FK_customers_ownerId_users_id');
    await queryRunner.dropTable('customers');

    await queryRunner.dropForeignKey('hotels', 'FK_hotels_ownerId_users_id');
    await queryRunner.dropTable('hotels');

    await queryRunner.dropIndex('users', 'IDX_users_email');
    await queryRunner.dropTable('users');
  }
}
