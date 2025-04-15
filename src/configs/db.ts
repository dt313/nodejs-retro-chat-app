import mongoose from 'mongoose';
import config from './config';

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', true);
        console.log('Connecting to MongoDB... ', config.databaseUrl);
        await mongoose.connect(config.databaseUrl);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection failed:', error);
        process.exit(1);
    }
};

export default { connectDB };
