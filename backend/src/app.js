import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'SecureShare API is running' });
});

//import the routes
import authRoutes from './routes/authRoutes.js';
app.use('/api/auth', authRoutes);

export default app;