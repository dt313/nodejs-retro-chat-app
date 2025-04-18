import { createClient } from 'redis';
import config from '@/configs/config';

export const client = createClient({
    url: config.redisUrl,
});

function connect() {
    client.connect();

    client.on('error', (err) => {
        console.error('Redis error: ', err);
    });

    client.on('connect', () => {
        console.log('Redis connected');
    });

    client.on('ready', (err) => {
        console.log('Redis Ready');
    });
}

export default { connect };
