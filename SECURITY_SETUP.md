# DigiLib Security Setup

## Render environment variables

Set these in the **backend Web Service** environment:

- `MONGO_URI` = your MongoDB Atlas connection string
- `CLOUDINARY_CLOUD_NAME` = your Cloudinary cloud name
- `CLOUDINARY_API_KEY` = your Cloudinary API key
- `CLOUDINARY_API_SECRET` = your Cloudinary API secret
- `ADMIN_EMAIL` = the private administrator email
- `ADMIN_PASSWORD` = a strong private administrator password
- `AUTH_SECRET` = a random secret of at least 32 characters

Example `AUTH_SECRET` generation on your computer:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do **not** put the real values in frontend HTML/JavaScript.

## What is protected

- Admin login is verified by the backend.
- Admin session is a signed token.
- Changing `localStorage` cannot grant backend admin permissions.
- Adding resources requires authentication.
- Deleting resources requires admin authentication.
- Students can cancel only their own requests.
- Admins can delete any request.
- `/me` restores the signed-in profile after page navigation/reload.
- User education level, school class, stream/course, and role are stored in MongoDB.

The browser may contain the session token because it needs to authenticate API requests, but the admin password and signing secret are never sent as frontend source code.
