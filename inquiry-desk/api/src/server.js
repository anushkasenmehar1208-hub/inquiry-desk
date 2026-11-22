import { app } from "./app.js";
import { pool } from "./db.js";

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`API ready at http://localhost:${port}`);
});

function close() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
