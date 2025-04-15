import { Express } from 'express';
import userRoutes from './user.routes';
import config from '@/configs/config';

const routes = (app: Express) => {
    app.use(`${config.apiBasePath}/users`, userRoutes);
};

export default routes;
