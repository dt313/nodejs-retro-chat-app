import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import db from './configs/db';
import redis from './configs/redis';
import ws from './configs/ws';
import route from './routes';
import { errorHandler } from './middlewares/error-handle';

const app = express();
const server = http.createServer(app);
db.connectDB();
redis.connect();
ws.initWSS(server);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
    cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
    }),
); // cors is a middleware that allows cross-origin requests
app.use(helmet()); // helmet is a middleware that helps secure the app by setting various HTTP headers
app.use(morgan('dev')); // log request to the console
app.use(compression()); // compress response bodies

route(app);

app.use(errorHandler);

export default server;
