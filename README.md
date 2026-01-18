# User Document Portal

A role-based User-Document management system that supports **secure PDF uploads up to 500MB**, real-time updates via **Socket.IO**, and cloud/local hybrid storage for optimized performance.

---

## 🚀 Features

* **Role-Based Access Control**

  * **OWNER / ADMIN**: Upload, update, delete documents
  * **VIEWER**: View-only access
* **Large File Support**

  * Upload PDFs up to **500MB**
* **Hybrid Storage Strategy**

  * Small files → **Cloudinary**
  * Large files → **Local filesystem**
* **Real-Time Sync**

  * Live document updates using **Socket.IO**
* **Secure Invitations**

  * Token-based invite links for onboarding users
* **Strict File Validation**

  * Server-side MIME validation (`application/pdf` only)

---

## 🧱 Tech Stack

* **Backend**: Node.js, Express, MongoDB (Mongoose)
* **Streaming Uploads**: Busboy
* **Cloud Storage**: Cloudinary (RAW files)
* **Realtime**: Socket.IO
* **Frontend**: React + React Router
* **Deployment**: Render

---

## 📂 Document Model (High-Level)

Each document stores metadata only:

* Original filename
* Storage type (`cloudinary` or `local`)
* File pointer (Cloudinary public ID or local path)
* File size
* Uploader reference
* Timestamps

No binary file data is stored in MongoDB.

---

## 📤 Upload Flow (500MB Optimized)

1. **Busboy streams the file** (no base64, no buffering entire file).
2. **Strict MIME validation** is performed server-side.
3. File size is tracked incrementally.
4. Storage decision:

   * **≤ Cloudinary limit** → buffered and uploaded to Cloudinary
   * **> Cloudinary limit** → streamed directly to disk
5. Metadata is saved to MongoDB.
6. Socket event notifies connected clients.

---

## 🔐 Authentication & Authorization

* JWT-based authentication
* Role enforcement at route level
* Socket connections restricted via CORS and explicit role-based room joining

---

## 🌐 Environment Variables

```env
PORT=5000
MONGO_URI=your_mongo_connection
FRONTEND_URL=https://your-frontend-url.onrender.com

JWT_SECRET=supersecret

# Upload limits
MAX_FILE_SIZE=524288000        # 500MB hard limit
CLOUDINARY_LIMIT=10000000      # ~10MB threshold

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxxx
CLOUDINARY_API_KEY=xxxx
CLOUDINARY_API_SECRET=xxxx
```

---

## 🔄 Real-Time Updates (Socket.IO)

* Events emitted:

  * `document:created`
  * `document:updated`
  * `document:deleted`
* Clients automatically sync document lists without refresh.
* Admin-only rooms (`admins`) allow scoped notifications.

---

## 🧠 Trade-offs & Design Decisions

### 1️⃣ Handling the 500MB Upload Constraint

**Problem:**
Uploading large files can crash the server if buffered entirely in memory or sent as base64.

**Solution:**

* Used **Busboy streaming** instead of `multer` or JSON uploads.
* Enforced **hard limits at two levels**:

  * Busboy `limits.fileSize`
  * Runtime byte counting
* Implemented **hybrid storage**:

  * Cloudinary for small files (fast, CDN-backed)
  * Local filesystem for large files (no cloud billing, no memory risk)

**Trade-off:**

* Local storage requires disk management and cleanup.
* Cloudinary RAW uploads have size limitations on free tiers.

This approach prioritizes **stability and scalability** over storage uniformity.

---

### 2️⃣ Why Not Store Everything in Cloud Storage?

* Cloud providers require billing details and have strict size limits.
* Free tiers are unreliable for very large PDFs.
* Hybrid storage allows:

  * Zero-cost handling of large files
  * Cloud performance benefits for small documents

---

### 3️⃣ Socket.IO Security

**Risks:**

* Unauthorized clients receiving real-time updates
* Cross-origin socket hijacking

**Mitigations:**

* Socket.IO CORS restricted to `FRONTEND_URL`
* WebSocket-only transport (no long polling)
* Role-based room joining (`admins`)
* Socket events emit only **after authenticated REST actions**

Sockets are **not trusted independently**; REST authentication is the source of truth.

---

### 4️⃣ Why Streaming Instead of Presigned URLs?

* Presigned URLs require cloud storage accounts (billing).
* Streaming gives full control and works across local + cloud storage.
* Easier to enforce server-side validation and auditing.

---

## 🧪 Known Limitations

* Large files stored locally are not CDN-backed
* No background virus scanning
* Cloudinary free tier limits RAW file size

These were accepted to meet the **no-billing constraint**.

---

## ✅ Summary

This system was designed with a strong focus on:

* **Memory safety**
* **Large file reliability**
* **Clear trade-offs**
* **Real-world deployment constraints**

It avoids common pitfalls like base64 uploads, oversized buffers, and insecure socket usage while remaining practical for free-tier deployments.

---

If you want:

* Full cloud streaming (S3 / R2)
* Signed URL downloads
* Chunked resumable uploads
* Background processing

…the architecture already supports evolving in that direction.

---

**Author:**
Pooja Dhandapani
