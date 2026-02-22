const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgres://postgres@localhost:5432/dexdb",
});

pool.query("SELECT 1", (err, res) => {
  if (err) {
    console.error("Error:", err);
  } else {
    console.log("Success:", res.rows);
  }
  pool.end();
});
