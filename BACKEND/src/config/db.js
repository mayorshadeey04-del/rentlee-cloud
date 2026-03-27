import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config();

const requireEnvVars=[
   "DB_HOST","DB_PORT","DB_NAME","DB_USER","DB_PASSWORD"
]

requireEnvVars.forEach((varName)=>{
    if (!process.env[varName]){
        console.log(`missing required env variable:${varName}`);
        process.exit(1)
    }
})

const db = new pg.Pool({
   user:process.env.DB_USER,
   host:process.env.DB_HOST,
   database:process.env.DB_NAME,
   password:process.env.DB_PASSWORD,
   port:process.env.DB_PORT,
})

db.connect().then(()=>console.log("Database is connected")).catch((err)=>{
      console.log("Connection denied", err);
      process.exit(1)
});

// db.on('connect', () => {
//   console.log('Database is connected');
// });

db.on("error",(err)=>{
    console.log("Database error:", err);
});

export default db;