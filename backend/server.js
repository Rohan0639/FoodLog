import express from 'express';
import cors from 'cors';
import config from './config.js';
import foodRouter from './routes/food.js';

const app = express();

// Allow requests from configured frontend URL + any vercel.app preview + localhost
const FRONTEND_URL = process.env.FRONTEND_URL || '';
app.use(cors({
  origin: (origin, callback) => {
    // Allow no-origin requests (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    // Allow localhost and 127.0.0.1 for local dev
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow any *.vercel.app subdomain (handles preview deployments too)
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return callback(null, true);
    // Allow explicitly configured frontend URL
    if (FRONTEND_URL && origin === FRONTEND_URL) return callback(null, true);
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse incoming JSON payloads
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Register routes
app.use('/', foodRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'foodlog-backend',
    timestamp: new Date()
  });
});

// Handle 404 Not Found
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UNHANDLED EXCEPTION]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

// Start the server only when running locally (not inside Vercel serverless environment)
if (!process.env.VERCEL) {
  app.listen(config.PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 FoodLog Backend service is running`);
    console.log(`🔊 Listening on port: ${config.PORT}`);
    console.log(`📡 Health endpoint: http://localhost:${config.PORT}/health`);
    console.log(`=================================================\n`);
  });
}

export default app;
