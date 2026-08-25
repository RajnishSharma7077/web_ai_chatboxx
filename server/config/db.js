import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.log('MONGODB_URI not set. Running in fallback in-memory mode.');
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');
    return true;
  } catch (error) {
    console.warn('MongoDB connection failed, using in-memory fallback:', error.message);
    return false;
  }
};

export const isMongoConnected = () => mongoose.connection.readyState === 1;
