import app from './app';
import config from './configs/config';

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
