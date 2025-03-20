# Smart Genesis
Smart Genesis is a powerful CLI tool designed to streamline project initialization for developers. It automates scaffolding for various project types—such as Web Apps, APIs, and CLI tools—by integrating popular frameworks (Next.js, Nest.js, Django, FastAPI, etc.) and overlaying customizable templates. Additionally, Smart Genesis features seamless GitHub repository creation through an integrated OAuth flow hosted on your deployed OAuth server.

## Features

### Flexible Scaffolding
Create projects for Web Apps, APIs, or CLI tools with tailored prompts.
For Web Apps, answer separate questions for the frontend and backend frameworks.
Choose between a monorepo (with separate frontend and backend directories) or separate repositories.

### Automatic Customization
Overlays professional templates for README and index files.
Generates a requirements.txt for Python projects with essential packages.

### GitHub OAuth Integration
Automatically opens GitHub's OAuth consent screen via your deployed OAuth server.
The OAuth server handles the sensitive OAuth flow and stores the access token.
Your CLI tool polls the /token endpoint on your OAuth server to retrieve the token.
Once obtained, Smart Genesis uses the token to create a GitHub repository, initialize Git, commit the scaffolded code, add a remote, and push the initial commit automatically.

## Installation
Install Smart Genesis globally using npm:

```bash
npm install -g smart-genesis
```
Or use npx:

```bash
npx smart-genesis
```

## Usage
Run the CLI tool from your terminal:

```bash
smart-genesis
```

### Interactive Workflow
Project Scaffolding:

**Prompts:**
- Enter your project name.
- Choose the project type (Web App, API, CLI Tool).
- For Web Apps, select your frontend framework (Next.js or React) and decide if you need a backend.
- If a backend is needed, choose a backend framework (Nest.js, or a Python framework such as Django, Flask, or FastAPI).
- Decide on the repository structure: monorepo or separate repositories.
- Choose whether to use TypeScript (for Next.js projects).

**Scaffolding:**
- Smart Genesis uses the appropriate CLI commands (e.g., npx create-next-app, npx nest new, or django-admin startproject) to scaffold your project and overlays custom templates.

### GitHub Repository Creation:

When prompted, choose to automatically create a Git repository.

**Steps:**
1. Smart Genesis will open your deployed OAuth server’s /login endpoint in your browser.
2. Complete the OAuth flow on GitHub. Your deployed server will handle the code exchange and store the access token.
3. The CLI tool then polls the /token endpoint on your OAuth server until the token is available.
4. Once the token is retrieved, Smart Genesis uses it to call the GitHub API, create a new repository, initialize Git, commit the scaffolded code, add the remote, and push the initial commit automatically.

### Hosted OAuth Service Configuration
Smart Genesis leverages a deployed OAuth server for secure GitHub integration. To use this feature:

- No Local Credential Setup Required. With the OAuth service handling sensitive credentials, end users do not need to set up any OAuth credentials locally.

### License
Smart Genesis is released under the MIT License.