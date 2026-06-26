**

# PROJECT 2: BACKEND REPOSITORY 
*(Put this inside your `Decode-2` Render Repo)*

```markdown
# ⚡ DecodeLabs API Server — Backend

A robust, decoupled RESTful API built with **Node.js, Express, and MongoDB Atlas**. Designed to handle secure CRUD operations and serve JSON payloads to authorized client applications.

🔗 **Live Production API:** `https://aesthete-api-yogzxx16.onrender.com`  
🔗 **Frontend Client Repository:** [INSERT_YOUR_FRONTEND_GITHUB_LINK_HERE]  

## 📖 Overview
This repository houses the backend infrastructure and database schemas for the platform. It enforces strict data modeling using **Mongoose ORM**, isolates sensitive database keys via environment variables, and utilizes **CORS** middleware to safely permit cross-origin requests from the Vercel frontend.

## ✨ Key Features
* **Cloud Vault Integration:** Fully connected to a distributed MongoDB Atlas cluster.
* **Strict Schema Validation:** Enforces `required: true` database rules to prevent bad data payloads.
* **Cross-Origin Enabled:** Pre-configured with CORS headers to accept external client calls.
* **Zero-Plaintext Security:** 100% of sensitive database credentials are locked behind `.env` variables.

## 🛠️ Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB Atlas (NoSQL Cloud)
* **ODM:** Mongoose
* **Middleware & Config:** `dotenv`, `cors`
* **Cloud Hosting:** Render

## 📡 API Route Map

| Method | Endpoint | Description | Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/articles` | Returns an array of all live articles in the database | `200 OK` |
| `GET` | `/articles/:id` | Fetches a single specific article by its unique MongoDB `_id` | `200 OK` |
| `POST` | `/articles` | Creates, validates, and saves a new article to the vault | `201 Created` |

## 🚀 Local Development Setup

### 1. Clone & Install
```bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/Decode-2.git](https://github.com/YOUR_GITHUB_USERNAME/Decode-2.git)
cd Decode-2
npm install
