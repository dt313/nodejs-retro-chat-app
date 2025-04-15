import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import db from './configs/db';
import route from './routes';
import { errorHandler } from './middlewares/error-handle';

const app = express();

db.connectDB();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // cors is a middleware that allows cross-origin requests
app.use(helmet()); // helmet is a middleware that helps secure the app by setting various HTTP headers
app.use(morgan('dev')); // log request to the console
app.use(compression()); // compress response bodies

route(app);

app.use(errorHandler);

export default app;
