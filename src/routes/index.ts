import { Express } from 'express';
import config from '@/configs/config';

import userRoutes from './user.routes';
import authRoutes from './auth.routes';
import conversationRoutes from './conversation.routes';
import groupRoutes from './groups.routes';
import invitationRoutes from './invitation.routes';
import notificationRoutes from './notification.routes';
import messageRouter from './message.routes';
import attachmentRouter from './attachment.routes';
import { verifyRefreshToken } from '@/helper/jwt';

const routes = (app: Express) => {
    app.use(`${config.apiBasePath}/users`, userRoutes);
    app.use(`${config.apiBasePath}/auth`, authRoutes);
    app.use(`${config.apiBasePath}/conversations`, conversationRoutes);
    app.use(`${config.apiBasePath}/groups`, groupRoutes);
    app.use(`${config.apiBasePath}/invitation`, invitationRoutes);
    app.use(`${config.apiBasePath}/notifications`, notificationRoutes);
    app.use(`${config.apiBasePath}/messages`, messageRouter);
    app.use(`${config.apiBasePath}/attachments`, attachmentRouter);
};

export default routes;
