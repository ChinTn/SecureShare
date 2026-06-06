import app from './app.js'; // Notice the .js extension!
import connectDB from './config/db.js';
import dotenv from 'dotenv'

const PORT = process.env.PORT || 5000;

dotenv.config({
  path: "./.env",
});

connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});