const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.postgresql://neondb_owner:npg_6fUL2GErzHMW@ep-dark-sky-ahog3ssp-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

module.exports = pool;



