import dotenv from 'dotenv';
import path from 'path';

const NODE_ENV = process.env.NODE_ENV || 'development';

const envFilePath = path.resolve(__dirname, `../../.env.${NODE_ENV}`);

dotenv.config({ path: envFilePath });

interface Config {
    port: number;
    nodeEnv: string;
    databaseUrl: string;
    apiBasePath: string;
}

const config: Config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    databaseUrl: process.env.DATABASE_URL || '',
    apiBasePath: process.env.API_BASE_PATH || '',
};

export default config;
