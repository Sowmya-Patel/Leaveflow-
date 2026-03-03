# LeaveFlow — Employee Leave Management System

A microservices-based web application for managing employee leave requests, built with Node.js and deployed via Docker.

## Project Structure

```
ibmproj/
├── auth-service/        # Authentication service (Port 5000)
├── leave-service/       # Leave management service (Port 7000)
├── frontend/            # Static frontend served via Nginx (Port 8080)
├── docker-compose.yml   # Docker Compose orchestration
└── .dockerignore
```

## Services

| Service | Description | Port |
|---|---|---|
| `auth-service` | Handles user registration, login, and JWT-based authentication | 5000 |
| `leave-service` | Manages leave requests, approvals, and employee/admin dashboards | 7000 |
| `frontend` | HTML/CSS/JS frontend served by Nginx | 8080 |

## Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) installed

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd ibmproj
```

### 2. Configure environment variables

Copy the template and fill in your values in `leave-service/.env`:

```bash
cp leave-service/env_template.txt leave-service/.env
```

### 3. Build and run with Docker Compose

```bash
docker-compose up --build
```
The application will be available at **http://localhost:8080**.

### 4. Stop the application

```bash
docker-compose down
```

## Features

- Employee registration and login
- Apply for and track leave requests
- Admin dashboard to approve or decline leave requests
- Email notifications for leave status updates
- Leave balance tracking per employee

## Tech Stack

- **Backend:** Node.js (Express)
- **Frontend:** HTML, CSS, JavaScript
- **Containerization:** Docker, Docker Compose
- **Web Server:** Nginx (frontend)

note:login credentials for admin and employees (username ,password) are in auth-service index.js file ,
for testing and trial admin login :username- hr1 / hr2 password- admin123 ,
employee login :username- john/sarah/mike password- emp123 ,
user can register as a new employee too.
