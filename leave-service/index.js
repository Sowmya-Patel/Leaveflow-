const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// --- Setup Nodemailer Gmail SMTP ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'testlsm7@gmail.com',
        pass: process.env.EMAIL_PASS
    }
});

// Verify connection configuration on startup
transporter.verify(function (error, success) {
    if (error) {
        console.error("-----------------------------------------");
        console.error("Nodemailer SMTP Verification Failed!");
        console.error(`Error Code: ${error.code}`);
        console.error(`Message: ${error.message}`);
        console.error("Action Required: Please check your EMAIL_USER and EMAIL_PASS in .env");
        console.error("If using Gmail, ensure you are using an 'App Password'.");
        console.error("-----------------------------------------");
    } else {
        console.log("Nodemailer Gmail SMTP is ready to send emails");
    }
});

async function sendEmailNotification(to, subject, text) {
    if (!transporter) {
        console.warn("Email notification skipped: Transporter not initialized.");
        return;
    }
    try {
        let info = await transporter.sendMail({
            from: `"LeaveFlow" <${process.env.EMAIL_USER || 'testlsm7@gmail.com'}>`,
            to: to,
            subject: subject,
            text: text
        });
        console.log("-----------------------------------------");
        console.log(`Email Sent successfully to ${to}`);
        console.log(`Message ID: ${info.messageId}`);
        console.log("-----------------------------------------");
    } catch (err) {
        console.error("-----------------------------------------");
        console.error("FAILED to send email notification");
        console.error(`Target: ${to}`);
        console.error(`Error: ${err.message}`);
        if (err.code === 'EAUTH') {
            console.error("Recommendation: Authentication failed. Use a Google App Password.");
        }
        console.error("-----------------------------------------");
    }
}
// ----------------------------------------------

const SECRET = "secretkey";
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";

let leaves = [];
let leaveBalances = {};

function toDateOnly(value) {
    return String(value || "").slice(0, 10);
}

function getTodayInAppTimezone() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(new Date());
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
}

// JWT Middleware
function verifyToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(403).json({ message: "Token required" });
    }

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
}

// Apply Leave
app.post("/apply", verifyToken, (req, res) => {

    const { type, reason, halfDay } = req.body;
    const startDate = toDateOnly(req.body.startDate);
    const endDate = toDateOnly(req.body.endDate);

    const start = new Date(startDate);
    const end = new Date(endDate);

    let duration = 0;
    if (halfDay) {
        duration = 0.5;
    } else {
        let current = new Date(start);
        while (current <= end) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Saturday (6) and Sunday (0)
                duration++;
            }
            current.setDate(current.getDate() + 1);
        }
    }

    if (duration === 0 && !halfDay) {
        return res.status(400).json({ message: "Selected date range only contains weekends. No leave days will be deducted." });
    }

    if (!leaveBalances[req.user.id]) {
        leaveBalances[req.user.id] = {
            casual: 10,
            sick: 10,
            paid: 10
        };
    }

    // Calculate how many leaves to deduct if approved
    const ongoingLeavesDuration = leaves
        .filter(l => l.userId === req.user.id && l.type === type && (l.status === "pending" || l.status === "approved"))
        .reduce((sum, l) => sum + l.duration, 0);

    const availableBalance = leaveBalances[req.user.id][type] - ongoingLeavesDuration;

    // Check if the requested duration exceeds the practically available balance
    if (duration > availableBalance) {
        return res.status(400).json({ message: `Insufficient balance for ${type} leave. You requested ${duration} days but only have ${availableBalance} left before overdrafting.` });
    }

    const leave = {
        id: leaves.length + 1,
        userId: req.user.id,
        employeeName: req.user.name,
        email: req.user.email || "no-email@example.com",
        type,
        startDate,
        endDate,
        reason,
        duration,
        halfDay: halfDay || false,
        status: "pending"
    };

    leaves.push(leave);

    res.json({ message: "Leave applied successfully" });
});

// Get Balance
app.get("/balance", verifyToken, (req, res) => {

    if (!leaveBalances[req.user.id]) {
        leaveBalances[req.user.id] = {
            casual: 10,
            sick: 10,
            paid: 10
        };
    }

    res.json(leaveBalances[req.user.id]);
});

// Get All Leaves (Admin)
app.get("/leaves", verifyToken, (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }

    res.json(leaves);
});

// Approve Leave (Admin)
app.post("/approve/:id", verifyToken, (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }

    const leaveId = parseInt(req.params.id);
    const leave = leaves.find(l => l.id === leaveId);

    if (!leave) {
        return res.status(404).json({ message: "Leave not found" });
    }

    if (leave.status === "approved") {
        return res.json({ message: "Already approved" });
    }

    leave.status = "approved";

    // Deduct only when approved!
    leaveBalances[leave.userId][leave.type] -= leave.duration;

    sendEmailNotification(
        leave.email,
        "Leave Application Approved",
        `Hello ${leave.employeeName},\n\nYour ${leave.type} leave requested from ${leave.startDate} to ${leave.endDate} has been approved.\n\nThank you.`
    );

    res.json({ message: "Leave approved successfully" });
});

// Decline Leave (Admin)
app.post("/decline/:id", verifyToken, (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }

    const leaveId = parseInt(req.params.id);
    const leave = leaves.find(l => l.id === leaveId);

    if (!leave) {
        return res.status(404).json({ message: "Leave not found" });
    }

    leave.status = "declined";

    // Balance was not deducted, so no refund is needed.

    sendEmailNotification(
        leave.email,
        "Leave Application Declined",
        `Hello ${leave.employeeName},\n\nWe regret to inform you that your ${leave.type} leave requested from ${leave.startDate} to ${leave.endDate} has been declined.\n\nPlease contact your manager for more details.`
    );

    res.json({ message: "Leave declined successfully" });
});

// Get Employee Leaves
app.get("/my-leaves", verifyToken, (req, res) => {

    const myLeaves = leaves.filter(l => l.userId === req.user.id);
    res.json(myLeaves);
});
app.get("/all", verifyToken, (req, res) => {

    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }

    res.json(leaves);
});
// Auto-End Expired Leaves Background Job
setInterval(() => {
    const todayStr = getTodayInAppTimezone();

    let updatedCount = 0;
    leaves.forEach(l => {
        if (l.status === "approved") {
            // If the current local date is strictly after the end date string
            if (todayStr > l.endDate) {
                l.status = "completed";
                updatedCount++;
            }
        }
    });

    if (updatedCount > 0) {
        console.log(`[Job] Automatically completed ${updatedCount} expired leaves.`);
    }
}, 10000); // Check every 10 seconds for testing

app.get("/on-leave", verifyToken, (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
    }
    const todayStr = getTodayInAppTimezone();

    const onLeaveUserIds = [...new Set(leaves
        .filter(l => l.status === "approved")
        .filter(l => {
            const leaveStart = toDateOnly(l.startDate);
            const leaveEnd = toDateOnly(l.endDate);
            return todayStr >= leaveStart && todayStr <= leaveEnd;
        })
        .map(l => l.userId)
    )];

    res.json(onLeaveUserIds);
});

// Diagnostics: Check Email Connection
app.get("/test-connection", (req, res) => {
    transporter.verify((error, success) => {
        if (error) {
            return res.status(500).json({
                status: "failed",
                error: error.message,
                code: error.code,
                recommendation: error.code === 'EAUTH' ? "Use a Google App Password instead of your regular password." : "Check your network and credentials."
            });
        }
        res.json({ status: "success", message: "SMTP Server is ready to take our messages" });
    });
});

app.listen(7000, () => {
    console.log("Leave Service running on port 7000");
});
