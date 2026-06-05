# OAuth Setup

CodeSphere uses server-side OAuth authorization code flow. Client secrets must exist only in `server/.env`.

## Required server environment variables

```env
CLIENT_ORIGIN=http://localhost:5173
API_ORIGIN=http://localhost:5000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
```

For production, set both origins to HTTPS URLs:

```env
CLIENT_ORIGIN=https://app.example.com
API_ORIGIN=https://api.example.com
```

## Callback URLs

Register these exact redirect/callback URLs in the provider consoles. The scheme, host, port, and path must match `API_ORIGIN`.

Development:

```text
Google:    http://localhost:5000/api/auth/oauth/google/callback
GitHub:    http://localhost:5000/api/auth/oauth/github/callback
LinkedIn:  http://localhost:5000/api/auth/oauth/linkedin/callback
Microsoft: http://localhost:5000/api/auth/oauth/microsoft/callback
Apple:     http://localhost:5000/api/auth/oauth/apple/callback
```

Production example:

```text
Google:    https://api.example.com/api/auth/oauth/google/callback
GitHub:    https://api.example.com/api/auth/oauth/github/callback
LinkedIn:  https://api.example.com/api/auth/oauth/linkedin/callback
Microsoft: https://api.example.com/api/auth/oauth/microsoft/callback
Apple:     https://api.example.com/api/auth/oauth/apple/callback
```

## Provider setup

Google OAuth 2.0:
- Create an OAuth 2.0 Client ID of type Web application.
- Add the callback URL under Authorized redirect URIs.
- Use scopes: `openid email profile`.

GitHub OAuth App:
- Create an OAuth App.
- Set Authorization callback URL to the GitHub callback URL above.
- Use scopes: `read:user user:email`.

LinkedIn OAuth 2.0:
- Enable Sign In with LinkedIn using OpenID Connect.
- Add the LinkedIn callback URL under authorized redirect URLs.
- Use scopes: `openid profile email`.
- LinkedIn may not return a public profile URL for all apps/accounts; CodeSphere stores it only when the provider returns it.

Microsoft Entra ID:
- Register an app in Microsoft Entra ID.
- Add a Web redirect URI matching the Microsoft callback URL above.
- Create a client secret.
- Use scopes: `openid profile email User.Read`.

Apple Sign in:
- Create a Services ID for web sign-in.
- Add the Apple callback URL under Return URLs.
- Use the Services ID as `APPLE_CLIENT_ID`.
- Generate an Apple client secret JWT and set it as `APPLE_CLIENT_SECRET`.
- Apple only returns name on the first consent; CodeSphere falls back to the account email name when needed.

## Verification

Start the backend and open:

```text
http://localhost:5000/api/auth/oauth/providers
```

Each provider should return `"configured": true` after its client ID and client secret are present in `server/.env` and the server is restarted.
