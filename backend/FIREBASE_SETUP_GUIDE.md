# Firebase Setup Guide

This guide matches the current backend code in `src/database/firebase.js`.

The database layer now follows the official Firebase Admin SDK pattern for Firestore:

- `initializeApp(...)` from `firebase-admin/app`
- `cert(...)` for the service account
- `getFirestore(...)` from `firebase-admin/firestore`

## What This Backend Expects

The backend uses the Firebase Admin SDK and initializes Firestore from:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_PATH`

If `FIREBASE_SERVICE_ACCOUNT_PATH` is not set, the code falls back to:

```txt
backend/firebase-service-account.json
```

So the easiest setup is:

1. create a Firebase project
2. enable Cloud Firestore
3. download a service account JSON key
4. place it at `backend/firebase-service-account.json`
5. set the correct project ID in `backend/.env`

## 1. Create A Firebase Project

In the Firebase console:

1. Click `Add project`
2. Create or choose your project
3. Finish the project setup

## 2. Create A Firestore Database

In the Firebase console:

1. Open your project
2. Go to `Build` -> `Firestore Database`
3. Click `Create database`
4. Choose a location
5. Create the default database

Use the normal Cloud Firestore database for this backend. The code connects to the default Firestore database.

## 3. Generate A Service Account Key

In the Firebase console:

1. Open your project
2. Click the gear icon -> `Project settings`
3. Open the `Service accounts` tab
4. Click `Generate new private key`
5. Download the JSON file

Important:

- keep this JSON file private
- do not commit it to git
- treat it like a password

## 4. Put The JSON File In The Backend Folder

Recommended path:

```txt
backend/firebase-service-account.json
```

If you use that path, your current `.env` value can stay:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

If you want to keep the key somewhere else, change the env value to the full or relative path.

Examples:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
```

```env
FIREBASE_SERVICE_ACCOUNT_PATH=D:/keys/firebase-service-account.json
```

## 5. Update `backend/.env`

Set these values:

```env
FIREBASE_PROJECT_ID=your-real-firebase-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

How to find `FIREBASE_PROJECT_ID`:

- open Firebase console
- go to `Project settings`
- copy the `Project ID`

## 6. Install Dependencies

From the `backend` folder:

```powershell
npm install
```

## 7. Start The Backend

From the `backend` folder:

```powershell
npm run dev
```

If Firebase is configured correctly, you should see a success log from the backend.

If it is not configured correctly, this project may show warnings like:

```txt
Firebase service account not found
Firebase features will be disabled until proper credentials are provided
```

or:

```txt
Firestore is not initialized. Add a valid firebase-service-account.json file.
```

## 8. Quick Verification

After the server starts:

1. call `GET /health`
2. upload a file to:

```txt
POST /api/documents/upload
```

In Postman use:

- Body -> `form-data`
- key name: `file`
- key type: `File`
- choose a file

Optional:

- header `X-User-Id: dev-user`

## 9. Common Problems

### `Firebase service account not found`

Check:

- the JSON file actually exists
- the path in `FIREBASE_SERVICE_ACCOUNT_PATH` is correct
- the path is relative to the backend process working directory

### `Firebase initialization error`

Check:

- the JSON file is valid JSON
- the key belongs to the same Firebase/Google Cloud project
- `FIREBASE_PROJECT_ID` matches the real project ID

### Upload route works but saving fails

That usually means:

- the backend started
- but Firestore was not initialized

Check the server logs and the service account path first.

## 10. Recommended Local Setup

For this repo, the simplest working setup is:

```txt
backend/.env
backend/firebase-service-account.json
```

with:

```env
FIREBASE_PROJECT_ID=your-real-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

## Official References

- Firebase Admin SDK setup: https://firebase.google.com/docs/admin/setup
- Cloud Firestore quickstart: https://firebase.google.com/docs/firestore/quickstart
- Firestore database management: https://firebase.google.com/docs/firestore/manage-databases
