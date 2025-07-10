import server from './app';
import config from './configs/config';

// // change on production
server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
