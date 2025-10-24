import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env.local' });

const connectionSource = new DataSource({
    type: process.env.TYPEORM_CONNECTION as 'postgres',
    host: process.env.TYPEORM_HOST,
    port: Number(process.env.TYPEORM_PORT),
    username: process.env.TYPEORM_USERNAME,
    password: process.env.TYPEORM_PASSWORD,
    database: process.env.TYPEORM_DATABASE,
    entities: [__dirname + '/**/*.entity.js'],
    migrations: [__dirname + '/migrations/*.js']
});
export default connectionSource;
