import express from 'express';
import cors from 'cors';
import config from './config.js';
import foodRouter from './routes/food.js';

const app = express();

// Enable Cross-Origin Resource Sharing for frontend integration
app.use(cors());

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

// Start the server
app.listen(config.PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🚀 FoodLog Backend service is running`);
  console.log(`🔊 Listening on port: ${config.PORT}`);
  console.log(`📡 Health endpoint: http://localhost:${config.PORT}/health`);
  console.log(`=================================================\n`);
});
