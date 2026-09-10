import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4100);
createApp().listen(PORT, () => {
  console.log(`mock-app listening on http://localhost:${PORT}`);
});
