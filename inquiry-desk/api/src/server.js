import { app } from "./app.js";
import { pool } from "./db.js";

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, (error) => {
  if (error) {
    console.error(`API failed to start on port ${port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`API ready at http://localhost:${port}`);
});

function close() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
