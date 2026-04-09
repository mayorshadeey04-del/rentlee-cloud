import express from 'express';
import cors from 'cors';

import signupRoutes from './routes/signup.routes.js';
import signinRoutes from './routes/signin.routes.js';
import caretakersRoutes from './routes/caretakers.routes.js';
import tenantsRoutes from './routes/tenants.routes.js';
import propertiesRoutes from './routes/properties.routes.js';
import unitsRoutes from './routes/units.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import roomTypesRoutes from './routes/roomtypes.routes.js';
import tenantDashboardRoutes from './routes/tenantdashboard.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import profileRoutes from './routes/profile.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

// 1. CORS Middleware must be the first to handle preflight requests
app.use(cors({
  origin: [
    'https://rentlee-cloud-l6ur.vercel.app',
    'https://rentlee-cloud.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Process JSON data after CORS check
app.use(express.json());

// API Routes
app.use('/api/signup', signupRoutes);
app.use('/api/signin', signinRoutes);
app.use('/api/caretakers', caretakersRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/roomtypes', roomTypesRoutes);
app.use('/api/tenant-dashboard', tenantDashboardRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Rentlee API is running" });
});

export default app;