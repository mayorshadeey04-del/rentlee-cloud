import express from 'express'
import cors from 'cors'

// Import routes here later
// import userRoutes from "./modules/user/user.routes.js";
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

// Global Middleware
app.use(express.json());
// app.use(cors());
app.use(cors({
  origin: [
    'http://127.0.0.1:5501',
    'http://localhost:5173'
  ],
  credentials: true
}));
// Routes (example)
// app.use("/api/users", userRoutes);
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

// Health check route
app.get("/", (req, res) => {
  res.json({ message: "Rentlee API is running" });
});

export default app;



// import express from 'express';

// import propertiesRoutes from './routes/properties.routes.js';
// import unitsRoutes from './routes/units.routes.js';
// import tenantsRoutes from './routes/tenants.routes.js';
// import caretakersRoutes from './routes/caretakers.routes.js';
// import maintenanceRoutes from './routes/maintenance.routes.js';
// import dashboardRoutes from './routes/dashboard.routes.js';

// const app = express();

// app.use('/api/properties', propertiesRoutes);
// app.use('/api/units', unitsRoutes);
// app.use('/api/tenants', tenantsRoutes);
// app.use('/api/caretakers', caretakersRoutes);
// app.use('/api/maintenance', maintenanceRoutes);
// app.use('/api/dashboard', dashboardRoutes);

// export default app;