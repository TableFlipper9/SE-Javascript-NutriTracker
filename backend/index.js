require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
const dayLogRoutes = require("./routes/dayLogs");
const mealRoutes = require("./routes/meals");
const foodRoutes = require("./routes/foods");
const summaryRoutes = require("./routes/summary");
const accountRoutes = require("./routes/account");

const app = express();

app.use(express.json());

// Allow common local dev ports by default; configure with CORS_ORIGINS (comma-separated).
const defaultOrigins = [
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

const allowedOrigins = (process.env.CORS_ORIGINS || defaultOrigins.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // non-browser clients (curl/postman) may omit Origin
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/day-logs", dayLogRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/account", accountRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
