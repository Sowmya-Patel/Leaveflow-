const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());

const SECRET = "secretkey";

const USERS_FILE = path.join(__dirname, "users.json");

let users = [
  { id: 1, username: "hr1", password: "admin123", role: "admin", name: "HR Manager 1", email: "hr1@company.com", contactNo: "555-0101", address: "123 Admin St, City" },
  { id: 2, username: "hr2", password: "admin123", role: "admin", name: "HR Manager 2", email: "hr2@company.com", contactNo: "555-0102", address: "124 Admin St, City" },
  { id: 3, username: "john", password: "emp123", role: "employee", name: "John Doe", email: "john@company.com", contactNo: "555-0201", address: "456 Emp Row, City" },
  { id: 4, username: "sarah", password: "emp123", role: "employee", name: "Sarah Smith", email: "sarah@company.com", contactNo: "555-0202", address: "457 Emp Row, City" },
  { id: 5, username: "mike", password: "emp123", role: "employee", name: "Mike Johnson", email: "mike@company.com", contactNo: "555-0203", address: "458 Emp Row, City" }
];

// Load users from file if it exists
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, "utf8");
    users = JSON.parse(data);
  } catch (err) {
    console.error("Error loading users file:", err);
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving users file:", err);
  }
}

// JWT Middleware for profile logic
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(403).json({ message: "Token required" });
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

app.post("/login", (req, res) => {
  const { username, password, role } = req.body;

  const user = users.find(u =>
    u.username === username &&
    u.password === password &&
    u.role === role
  );

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, username: user.username, email: user.email },
    SECRET,
    { expiresIn: "10h" } // Kept increased expiry for testing convenience
  );

  res.json({ token, email: user.email }); // Also returning email to help frontend/leave-service if needed
});

app.post("/register", (req, res) => {
  const { username, password, name, email, contactNo, address } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ message: "Username, password, and name are required." });
  }

  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({ message: "Username already exists." });
  }

  const newUser = {
    id: users.length + 1,
    username,
    password,
    role: "employee",
    name,
    email: email || "",
    contactNo: contactNo || "",
    address: address || ""
  };

  users.push(newUser);
  saveUsers();
  res.json({ message: "Employee registered successfully." });
});

app.get("/profile", verifyToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  res.json({
    name: user.name,
    email: user.email,
    contactNo: user.contactNo,
    address: user.address,
    role: user.role
  });
});

app.get("/employee-count", (req, res) => {
  const count = users.filter(u => u.role === "employee").length;
  res.json({ count });
});

app.get("/employees", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }
  const employees = users.filter(u => u.role === "employee").map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    contactNo: u.contactNo,
    address: u.address
  }));
  res.json(employees);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Auth Service running on port ${PORT}`);
});
