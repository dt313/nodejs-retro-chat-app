import server from './app';
import config from './configs/config';

// // change on production
server.listen(config.port, '192.168.1.100', () => {
    console.log(`Server running on port ${config.port}`);
});
