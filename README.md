# TutorBridge

TutorBridge is a browser-based tutoring platform that helps students find tutors, communicate with them, and manage tutoring assignments. Tutors can create profiles, connect with students, and assign quizzes or flashcards.

## Features

- Email/password authentication and account setup
- Student and tutor profiles
- Tutor search and recommendations
- Location-aware tutor discovery using Mapbox
- Direct messaging between students and tutors
- Tutor/student relationship management
- Ratings and profile information
- Homework and assignment creation
- Quiz and flashcard assignments
- Calendar and assignment views
- Responsive interface built with plain HTML and CSS

## Project structure

| File | Purpose |
| --- | --- |
| `login.html` | Sign-in page |
| `signup.html` | Account registration |
| `accountsetup.html` | Initial student or tutor profile setup |
| `home.html` | Main dashboard |
| `search-results.html` | Tutor search results |
| `profile.html` | Public tutor or student profile |
| `mytutors.html` | Student tutor relationships and assignments |
| `mystudents.html` | Tutor student relationships and assignments |
| `messages.html` | Direct messaging |
| `assign-homework.html` | Assignment creation |
| `question-create.html` | Question creation |
| `quiz.html` | Quiz assignment view |
| `flashcards.html` | Flashcard assignment view |
| `settings.html` | Profile and account settings |
| `editLogin.html` | Login credential updates |
| `app.js` | Application logic and Supabase queries |
| `styles.css` | Shared styling |
| `logo.jpg` | Project image asset |

## Requirements

- A modern web browser
- A Supabase project
- A Mapbox public access token for geocoding and maps
- A local static web server for development

No Node.js package installation or build step is required. The pages load the Supabase JavaScript client and Mapbox libraries from their hosted CDNs.

## Configuration

The frontend configuration is defined at the top of `app.js`:

```js
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-supabase-anon-key";
const MAPBOX_ACCESS_TOKEN = "pk.your-mapbox-public-token";
```

Use only public browser-safe credentials in this file:

- Supabase: use the project URL and anonymous public key.
- Mapbox: use a `pk.` public token restricted to the required domains and APIs.
- Never place a Supabase `service_role` key, a Mapbox `sk.` token, or another server secret in frontend files.

If a credential has been exposed that should be secret, revoke or rotate it before removing it from the repository.

## Supabase setup

Create a Supabase project and configure the database tables and authentication policies expected by `app.js`. The application uses Supabase Auth and tables for user information, tutor/student relationships, messages, assignments, assignment questions, and ratings.

Row Level Security should be enabled for application tables. Policies should allow users to read and modify only the records appropriate to their role and relationship. Do not rely on hiding a key in frontend code for access control.

## Running locally

Because the application uses multiple HTML pages and browser APIs, serve the project through a local HTTP server instead of opening an HTML file directly.

For example, with Python installed:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/login.html
```

You can also use any static-file server or the Live Server extension in VS Code.

## Deployment

TutorBridge can be deployed to any static hosting provider, such as GitHub Pages, Netlify, or Vercel static hosting:

1. Configure the Supabase and Mapbox public values for the deployment.
2. Add the deployed site URL to Supabase Auth redirect and site URL settings.
3. Add the deployed domain to the Mapbox token's allowed URLs.
4. Deploy the project files.
5. Confirm authentication, database policies, geocoding, messaging, and assignments in the deployed environment.

## Security notes

- Public frontend tokens are not substitutes for database security policies.
- Configure Supabase Row Level Security and least-privilege policies.
- Restrict Mapbox tokens by domain and permitted APIs.
- Do not commit `.env` files, private keys, passwords, or service credentials.
- If GitHub push protection flags a token, confirm whether it is genuinely public before allowing the push. Rotate any token that is not intended for browser exposure.

## Git workflow

To create a commit:

```powershell
git add .
git commit -m "Describe your changes"
```

To push the `main` branch:

```powershell
git push -u origin main
```

## License

No license has been specified for this project yet.
