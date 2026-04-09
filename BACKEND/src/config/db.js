import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config();

// 1. Check if we are running in the Cloud (Render) or Locally
const isProduction = !!process.env.DATABASE_URL;

// 2. Only strictly enforce the 5 local variables if we are NOT on Render
if (!isProduction) {
    const requireEnvVars = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
    requireEnvVars.forEach((varName) => {
        if (!process.env[varName]) {
            console.error(`Missing required local env variable: ${varName}`);
            process.exit(1);
        }
    });
}

// 3. Intelligently connect based on the environment
const db = new pg.Pool(
    isProduction
        ? {
              //  CLOUD: Use the Supabase URL and turn on SSL
              connectionString: process.env.DATABASE_URL,
              ssl: { rejectUnauthorized: false } 
          }
        : {
              //  LOCAL: Use your 5 specific variables
              user: process.env.DB_USER,
              host: process.env.DB_HOST,
              database: process.env.DB_NAME,
              password: process.env.DB_PASSWORD,
              port: process.env.DB_PORT,
          }
);

db.connect()
    .then(() => console.log(isProduction ? " Cloud Database is connected" : " Local Database is connected"))
    .catch((err) => {
        console.error("Connection denied", err);
        process.exit(1);
    });

db.on("error", (err) => {
    console.error("Database error:", err);
});

export default db;