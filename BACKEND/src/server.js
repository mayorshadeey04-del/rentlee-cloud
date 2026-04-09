import dotenv from 'dotenv'
import app from './app.js'
import db from './config/db.js'// ensures DB connects

dotenv.config();

const PORT = process.env.PORT || 5001;

// Adding '0.0.0.0' forces the server to open itself to the internet
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on PORT ${PORT}`);
});


// import express from 'express'
// import cors from 'cors'
// import dotenv from 'dotenv'
// import db from './config/db.js'   //  ADD THIS LINE

// dotenv.config();

// const app = express();

// const PORT = 5001;

// app.use(express.json())
// app.use(cors())

// app.listen(PORT, () => {
//     console.log(`Server running on PORT ${PORT}`);
// });