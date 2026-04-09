import dotenv from 'dotenv';
import app from './app.js';
import db from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on PORT ${PORT}`);
});