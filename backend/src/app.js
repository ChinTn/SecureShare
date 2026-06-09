import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const app = express();

app.use(helmet());
app.use(cors({
  origin: [process.env.CLIENT_URL, 'http://localhost:5174', 'http://localhost:5173'],
  credentials: true
}));

app.use(express.json({ limit: '150mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'SecureShare API is running' });
});

//import the routes
import authRoutes from './routes/authRoutes.js';
app.use('/api/auth', authRoutes);

import fileRoutes from './routes/fileRoutes.js';
app.use('/api/files', fileRoutes);

import shareRoutes from './routes/shareRoutes.js';
app.use('/api/share', shareRoutes);

import auditRoutes from './routes/auditRoutes.js';
app.use('/api/audit', auditRoutes);

export default app;