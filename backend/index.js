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
app.use(cors({
  origin: ["http://localhost:5500"],
  credentials: true
}));

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
