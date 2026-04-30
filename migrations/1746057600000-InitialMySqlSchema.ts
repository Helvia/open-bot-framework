import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMySqlSchema1746057600000 implements MigrationInterface {
    name = 'InitialMySqlSchema1746057600000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create open_bot table
        await queryRunner.query(`
            CREATE TABLE \`open_bot\` (
                \`id\` char(36) NOT NULL,
                \`handle\` varchar(255) NOT NULL,
                \`endpoint\` varchar(255) NOT NULL,
                \`schemaVersion\` varchar(255) NOT NULL DEFAULT 'v1.3',
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`IDX_OpenBot_handle\` (\`handle\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);

        // Create open_bot_secret table
        await queryRunner.query(`
            CREATE TABLE \`open_bot_secret\` (
                \`id\` char(36) NOT NULL,
                \`description\` varchar(255) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`expiresAt\` datetime NULL,
                \`secretHash\` varchar(255) NOT NULL,
                \`plainReducted\` varchar(255) NOT NULL,
                \`openBotId\` char(36) NULL,
                INDEX \`FK_open_bot_secret_openBot\` (\`openBotId\`),
                PRIMARY KEY (\`id\`),
                CONSTRAINT \`FK_open_bot_secret_openBot\` FOREIGN KEY (\`openBotId\`) REFERENCES \`open_bot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);

        // Create web_chat_channel table
        await queryRunner.query(`
            CREATE TABLE \`web_chat_channel\` (
                \`id\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`secret1\` varchar(255) NOT NULL,
                \`secret2\` varchar(255) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`openBotId\` char(36) NULL,
                INDEX \`IDX_web_chat_channel_secret1\` (\`secret1\`),
                INDEX \`IDX_web_chat_channel_secret2\` (\`secret2\`),
                INDEX \`FK_web_chat_channel_openBot\` (\`openBotId\`),
                PRIMARY KEY (\`id\`),
                CONSTRAINT \`FK_web_chat_channel_openBot\` FOREIGN KEY (\`openBotId\`) REFERENCES \`open_bot\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`web_chat_channel\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`open_bot_secret\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`open_bot\``);
    }
}
