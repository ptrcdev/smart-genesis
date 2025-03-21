#!/usr/bin/env node
const inquirer = require('inquirer');
const handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const open = require('open').default;
const dotenv = require('dotenv');
dotenv.config();

const prompt = inquirer.createPromptModule();

function normalizeProjectNameForDjango(name) {
    // Convert to lowercase
    let normalized = name.toLowerCase();
    // Replace hyphens and spaces with underscores
    normalized = normalized.replace(/[-\s]+/g, '_');
    // Remove any character that is not alphanumeric or underscore
    normalized = normalized.replace(/[^a-z0-9_]/g, '');
    // Ensure it doesn't start with a number: prepend an underscore if it does
    if (/^[0-9]/.test(normalized)) {
        normalized = '_' + normalized;
    }
    return normalized;
}

async function promptUser() {
    const common = await prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Enter your project name:',
            default: 'my-awesome-project'
        },
        {
            type: 'list',
            name: 'projectType',
            message: 'Select the type of project:',
            choices: ['Web App', 'API', 'CLI Tool'],
            default: 'Web App'
        },
        {
            type: 'input',
            name: 'description',
            message: 'Enter a short project description (optional):',
            default: ''
        }
    ]);

    if (common.projectType === 'Web App') {
        const webQuestions = await prompt([
            {
                type: 'list',
                name: 'frontendFramework',
                message: 'Select your frontend framework:',
                choices: ['Next.js', 'React', 'Vite'],
                default: 'Next.js'
            },
            {
                type: 'confirm',
                name: 'includeBackend',
                message: 'Do you need a backend?',
                default: true
            },
            {
                type: 'list',
                name: 'backendFramework',
                message: 'Select your backend framework:',
                choices: ['Nest.js', 'Python (Django)', 'Python (Flask)', 'Python (FastAPI)'],
                when: answers => answers.includeBackend
            },
            {
                type: 'list',
                name: 'repoStructure',
                message: 'Do you want a monorepo or separate repositories for frontend and backend?',
                choices: ['Monorepo', 'Separate Repos'],
                when: answers => answers.includeBackend
            },
            {
                type: 'confirm',
                name: 'useTypeScript',
                message: 'Would you like to use TypeScript for your frontend?',
                default: true,
                when: answers => common.frontendFramework === 'Next.js'
            }
        ]);
        return { ...common, ...webQuestions };
    }

    if (common.projectType === 'API') {
        const apiQuestions = await prompt([
            {
                type: 'list',
                name: 'apiFramework',
                message: 'Select your API framework:',
                choices: ['Nest.js', 'Python (Django)', 'Python (Flask)', 'Python (FastAPI)'],
                default: 'Nest.js'
            }
        ]);
        return { ...common, ...apiQuestions };
    }

    if (common.projectType === 'CLI Tool') {
        const cliQuestions = await prompt([
            {
                type: 'list',
                name: 'cliLanguage',
                message: 'Select your preferred language for the CLI tool:',
                choices: ['Node.js', 'Bash', 'Python'],
                default: 'Node.js'
            }
        ]);
        return { ...common, ...cliQuestions };
    }

    return common;
}

function runCommand(command, cwd = process.cwd()) {
    try {
        console.log(`Running: ${command} in ${cwd}`);
        execSync(command, { stdio: 'inherit', cwd });
    } catch (error) {
        console.error(`Error executing command: ${command}\n`, error);
        process.exit(1);
    }
}

function renderTemplate(templatePath, context) {
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    return template(context);
}

function createPythonRequirements(backendFramework, targetDir) {
    let requirements = '';
    if (backendFramework.includes('Django')) {
        requirements = `Django>=3.2,<4.0
djangorestframework
gunicorn`;
    } else if (backendFramework.includes('Flask')) {
        requirements = `Flask
gunicorn
requests`;
    } else if (backendFramework.includes('FastAPI')) {
        requirements = `fastapi
uvicorn
pydantic`;
    }
    fs.writeFileSync(path.join(targetDir, 'requirements.txt'), requirements, 'utf-8');
    console.log(`[Smart Genesis] requirements.txt created in ${targetDir}`);
}

// --- Scaffolding Functions ---
async function scaffoldMonorepo(context) {
    const projectDir = path.join(process.cwd(), context.projectName);
    fs.ensureDirSync(projectDir);
    const appsDir = path.join(projectDir, 'apps');
    fs.ensureDirSync(appsDir);
    runCommand('npm init -y', projectDir);

    // Frontend
    if (context.frontendFramework === 'Next.js' || context.frontendFramework === 'React' || context.frontendFramework === 'Vite') {
        const frontendDir = path.join(appsDir, 'frontend');
        fs.ensureDirSync(frontendDir);
        if (context.frontendFramework === 'Next.js') {
            const tsFlag = context.useTypeScript ? ' --typescript' : '';
            console.log(`Initializing Next.js app in ${frontendDir}...`);
            runCommand(`npx create-next-app .${tsFlag} --skip-git`, frontendDir);
        } else if (context.frontendFramework === 'React') {
            console.log(`Initializing Create React App in ${frontendDir}...`);
            runCommand(`npx create-react-app . --skip-git`, frontendDir);
        } else {
            console.log(`Initializing Vite app in ${frontendDir}...`);
            runCommand(`npx create-vite@latest . --template ${context.frontendFramework} --skip-git`, frontendDir);
        }
    }

    // Backend
    if (context.includeBackend) {
        const backendDir = path.join(appsDir, 'backend');
        fs.ensureDirSync(backendDir);
        if (context.backendFramework === 'Nest.js') {
            console.log(`Initializing NestJS app in ${backendDir}...`);
            runCommand(`npx nest new . --skip-install --skip-git`, backendDir);
        } else if (context.backendFramework.startsWith('Python')) {
            runCommand('python -m venv .venv', backendDir);
            runCommand('source .venv/bin/activate', backendDir);
            if (context.backendFramework.includes('Django')) {
                console.log(`Initializing Django project in ${backendDir}...`);
                runCommand('python3 -m pip install Django', backendDir);
                runCommand(`python -m django startproject ${normalizeProjectNameForDjango(context.projectName)} .`, backendDir);
            } else if (context.backendFramework.includes('Flask')) {
                console.log(`Initializing Flask project in ${backendDir}...`);
                runCommand('python3 -m pip install Flask', backendDir);
                fs.ensureDirSync(backendDir);
                fs.writeFileSync(path.join(backendDir, 'app.py'),
                    `from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({"message": "Hello from ${context.projectName}!"})

if __name__ == "__main__":
    app.run(debug=True)
`, 'utf-8');
            } else if (context.backendFramework.includes('FastAPI')) {
                console.log(`Initializing FastAPI project in ${backendDir}...`);
                runCommand('python3 -m pip install FastAPI', backendDir);
                fs.ensureDirSync(backendDir);
                fs.writeFileSync(path.join(backendDir, 'main.py'),
                    `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "${context.projectName}"}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`, 'utf-8');
            }
            createPythonRequirements(context.backendFramework, backendDir);
        }
    }

    console.log(`[Smart Genesis] Monorepo structure for "${context.projectName}" has been created.`);
}

async function scaffoldSeparateRepos(context) {
    // Frontend Repo
    if (context.frontendFramework === 'Next.js' || context.frontendFramework === 'React' || context.frontendFramework === 'Vite') {
        const frontendName = `${context.projectName}-frontend`;
        const frontendDir = path.join(process.cwd(), frontendName);
        fs.ensureDirSync(frontendDir);
        if (context.frontendFramework === 'Next.js') {
            const tsFlag = context.useTypeScript ? ' --typescript' : '';
            console.log(`Initializing Next.js app in ${frontendDir}...`);
            runCommand(`npx create-next-app .${tsFlag} --skip-git`, frontendDir);
        } else if (context.frontendFramework === 'React') {
            console.log(`Initializing Create React App in ${frontendDir}...`);
            runCommand(`npx create-react-app . --skip-git`, frontendDir);
        } else {
            console.log(`Initializing Vite app in ${frontendDir}...`);
            runCommand(`npx create-vite@latest . --template ${context.frontendFramework} --skip-git`, frontendDir);
        }
    }

    // Backend Repo
    if (context.includeBackend) {
        const backendName = `${context.projectName}-backend`;
        const backendDir = path.join(process.cwd(), backendName);
        fs.ensureDirSync(backendDir);
        if (context.backendFramework === 'Nest.js') {
            console.log(`Initializing NestJS app in ${backendDir}...`);
            runCommand(`npx nest new . --skip-install --skip-git`, backendDir);
        } else if (context.backendFramework.startsWith('Python')) {
            if (context.backendFramework.includes('Django')) {
                console.log(`Initializing Django project in ${backendDir}...`);
                runCommand(`python -m django startproject ${normalizeProjectNameForDjango(context.projectName)} .`, backendDir);
            } else if (context.backendFramework.includes('Flask')) {
                console.log(`Initializing Flask project in ${backendDir}...`);
                fs.ensureDirSync(backendDir);
                fs.writeFileSync(path.join(backendDir, 'app.py'),
                    `from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({"message": "Hello from ${context.projectName}!"})

if __name__ == "__main__":
    app.run(debug=True)
`, 'utf-8');
            } else if (context.backendFramework.includes('FastAPI')) {
                fs.ensureDirSync(backendDir);
                fs.writeFileSync(path.join(backendDir, 'main.py'),
                    `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "${context.projectName}"}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`, 'utf-8');
            }
            createPythonRequirements(context.backendFramework, backendDir);
        }
    }

    console.log(`[Smart Genesis] Separate repositories have been created for "${context.projectName}".`);
}

async function scaffoldSingleRepo(context) {
    const projectDir = path.join(process.cwd(), context.projectName);
    fs.ensureDirSync(projectDir);

    if (context.projectType === 'API') {
        if (context.apiFramework === 'Nest.js') {
            console.log(`Initializing NestJS API in ${projectDir}...`);
            runCommand(`npx nest new . --skip-install --skip-git`, projectDir);
        } else if (context.apiFramework.startsWith('Python')) {
            runCommand('python -m venv .venv', projectDir);
            runCommand('source .venv/bin/activate', projectDir);
            if (context.apiFramework.includes('Django')) {
                console.log(`Initializing Django project in ${projectDir}...`);
                runCommand('python3 -m pip install Django', projectDir);
                runCommand(`python -m django startproject ${normalizeProjectNameForDjango(context.projectName)} .`, projectDir);
            } else if (context.apiFramework.includes('Flask')) {
                console.log(`Initializing Flask project in ${projectDir}...`);
                runCommand('python3 -m pip install Flask', projectDir);
                fs.ensureDirSync(projectDir);
                fs.writeFileSync(path.join(projectDir, 'app.py'),
                    `from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def index():
    return jsonify({"message": "Hello from ${context.projectName} API!"})

if __name__ == "__main__":
    app.run(debug=True)
`, 'utf-8');
            } else if (context.apiFramework.includes('FastAPI')) {
                runCommand('python3 -m pip install FastAPI', projectDir);
                fs.ensureDirSync(projectDir);
                fs.writeFileSync(path.join(projectDir, 'main.py'),
                    `from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "${context.projectName} API"}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`, 'utf-8');
            }
            createPythonRequirements(context.apiFramework, projectDir);
        }
    } else if (context.projectType === 'CLI Tool') {
        if (context.cliLanguage === 'Node.js') {
            fs.ensureDirSync(projectDir);
            fs.writeFileSync(path.join(projectDir, 'index.js'),
                `#!/usr/bin/env node
console.log("Welcome to ${context.projectName} CLI tool!");`, 'utf-8');
        } else if (context.cliLanguage === 'Bash') {
            fs.ensureDirSync(projectDir);
            fs.writeFileSync(path.join(projectDir, 'run.sh'),
                `#!/bin/bash
echo "Welcome to ${context.projectName} CLI tool!"`, 'utf-8');
        } else if (context.cliLanguage === 'Python') {
            fs.ensureDirSync(projectDir);
            fs.writeFileSync(path.join(projectDir, 'main.py'),
                `#!/usr/bin/env python3
print("Welcome to ${context.projectName} CLI tool!")`, 'utf-8');
        }
    } else {
        const frontendName = `${context.projectName}-frontend`;
        const frontendDir = path.join(process.cwd(), frontendName);
        fs.ensureDirSync(frontendDir);
        if (context.frontendFramework === 'Next.js' || context.frontendFramework === '  React' || context.frontendFramework === 'Vite') {
            const tsFlag = context.useTypeScript ? ' --typescript' : '';
            console.log(`Initializing Next.js app in ${frontendDir}...`);
            runCommand(`npx create-next-app .${tsFlag} --skip-git`, frontendDir);
        } else if (context.frontendFramework === 'React') {
            console.log(`Initializing Create React App in ${frontendDir}...`);
            runCommand(`npx create-react-app . --skip-git`, frontendDir);
        } else {
            console.log(`Initializing Vite app in ${frontendDir}...`);
            runCommand(`npx create-vite@latest . --template ${context.frontendFramework} --skip-git`, frontendDir);
        }
        console.log(`[Smart Genesis] Project scaffold for "${context.projectName}" has been created.`);
    }
}

async function overlayCustomFiles(context, targetDir, templateType) {
    const templateBase = path.join(__dirname, 'templates');
    const templateDir = path.join(templateBase, templateType);
    const readmeTemplatePath = path.join(templateDir, 'README.hbs');
    if (fs.existsSync(readmeTemplatePath)) {
        const readmeContent = renderTemplate(readmeTemplatePath, context);
        fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf-8');
    }
    const indexTemplatePath = path.join(templateDir, 'index.js.hbs');
    if (fs.existsSync(indexTemplatePath)) {
        const indexContent = renderTemplate(indexTemplatePath, context);
        fs.writeFileSync(path.join(targetDir, 'index.js'), indexContent, 'utf-8');
    }
    console.log(`[Smart Genesis] Custom files added to ${targetDir} using ${templateType} templates.`);
}

// URLs to match our deployed OAuth service.
const OAUTH_LOGIN_URL = 'https://oauth-server-production.up.railway.app/login';
const OAUTH_TOKEN_URL = 'https://oauth-server-production.up.railway.app/token';

async function pollForAccessToken() {
    const maxAttempts = 20;
    const delayMs = 3000;

    console.log('Waiting for access token from your OAuth server...');
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await axios.get(OAUTH_TOKEN_URL);
            if (response.data && response.data.token) {
                console.log('Access token received!');
                return response.data.token;
            }
        } catch (error) {
            console.error('Polling error:', error.message);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    throw new Error('Timed out waiting for access token.');
}

async function initiateOAuthFlow() {
    // Open the consent screen in the user's browser.
    console.log('Opening GitHub OAuth consent screen...');
    await open(OAUTH_LOGIN_URL);

    // Poll the deployed OAuth server for the token.
    const accessToken = await pollForAccessToken();
    return accessToken;
}

// Create a Git repository using the GitHub API and push the scaffolded project
async function createAndPushGitRepo(accessToken, projectName, targetDir, reposStructure) {
    try {
        console.log('[Smart Genesis] Creating GitHub repository...');
        let cloneUrl;
        if (reposStructure === 'Separate Repos') {
            const frontendRepoResponse = await axios.post(
                'https://api.github.com/user/repos',
                {
                    name: `${projectName}-frontend`,
                    description: 'Repository created automatically by Smart Genesis CLI',
                    private: false,
                },
                {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );
            const backendRepoResponse = await axios.post(
                'https://api.github.com/user/repos',
                {
                    name: `${projectName}-backend`,
                    description: 'Repository created automatically by Smart Genesis CLI',
                    private: false,
                },
                {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );
            const frontendCloneUrl = frontendRepoResponse.data.clone_url;
            const backendCloneUrl = backendRepoResponse.data.clone_url;
            console.log(`[Smart Genesis] Frontend repository created: ${frontendCloneUrl}`);
            console.log(`[Smart Genesis] Backend repository created: ${backendCloneUrl}`);

            // Initialize local git repository, commit, add remote, and push
            runCommand('git init', `${projectName}-frontend`);
            runCommand('git init', `${projectName}-backend`);

            runCommand('git add .', `${projectName}-frontend`);
            runCommand('git add .', `${projectName}-backend`);

            runCommand('git add .', targetDir);
            runCommand('git commit -m "Initial commit with scaffolded project"', `${projectName}-frontend`);
            runCommand('git commit -m "Initial commit with scaffolded project"', `${projectName}-backend`);
            runCommand(`git remote add origin ${frontendCloneUrl}`, `${projectName}-frontend`);
            runCommand(`git remote add origin ${backendCloneUrl}`, `${projectName}-backend`);
            runCommand('git branch -M main', `${projectName}-frontend`);
            runCommand('git branch -M main', `${projectName}-backend`);
            runCommand('git push -u origin main', `${projectName}-frontend`);
            runCommand('git push -u origin main', `${projectName}-backend`);
            console.log('[Smart Genesis] Code pushed to GitHub repository successfully.');
        } else {
            const repoResponse = await axios.post(
                'https://api.github.com/user/repos',
                {
                    name: projectName,
                    description: 'Repository created automatically by Smart Genesis CLI',
                    private: false,
                },
                {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: 'application/vnd.github.v3+json',
                    },
                }
            );
            cloneUrl = repoResponse.data.clone_url;
            console.log(`[Smart Genesis] Repository created: ${cloneUrl}`);
            // Initialize local git repository, commit, add remote, and push
            runCommand('git init', targetDir);

            if (reposStructure === 'Monorepo') {
                runCommand('git add .', path.join(targetDir, 'apps/frontend'));
                runCommand('git add .', path.join(targetDir, 'apps/backend'));
            }

            runCommand('git add .', targetDir);
            runCommand('git commit -m "Initial commit with scaffolded project"', targetDir);
            runCommand(`git remote add origin ${cloneUrl}`, targetDir);
            runCommand('git branch -M main', targetDir);
            runCommand('git push -u origin main', targetDir);
            console.log('[Smart Genesis] Code pushed to GitHub repository successfully.');
        }
    } catch (error) {
        console.error('Error creating or pushing to GitHub repository:', error.response?.data || error);
    }
}

async function promptForGitRepo() {
    return prompt([
        {
            type: 'confirm',
            name: 'createGit',
            message: 'Would you like to create a Git repository for your project?',
            default: false
        }
    ]);
}

async function main() {
    try {
        const answers = await promptUser();

        // Scaffolding logic
        if (answers.projectType === 'Web App') {
            if (answers.includeBackend) {
                if (answers.repoStructure === 'Monorepo') {
                    await scaffoldMonorepo(answers);
                    const projectDir = path.join(process.cwd(), answers.projectName);
                    overlayCustomFiles(answers, path.join(projectDir, 'apps/frontend'), 'web-app');
                    overlayCustomFiles(answers, path.join(projectDir, 'apps/backend'), 'api');
                } else {
                    await scaffoldSeparateRepos(answers);
                    const frontendDir = path.join(process.cwd(), `${answers.projectName}-frontend`);
                    const backendDir = path.join(process.cwd(), `${answers.projectName}-backend`);
                    overlayCustomFiles(answers, frontendDir, 'web-app');
                    overlayCustomFiles(answers, backendDir, 'api');
                }
            } else {
                const projectDir = path.join(process.cwd(), answers.projectName);
                fs.ensureDirSync(projectDir);
                if (answers.frontendFramework === 'Next.js') {
                    const tsFlag = answers.useTypeScript ? ' --typescript' : '';
                    console.log(`Initializing Next.js app in ${projectDir}...`);
                    runCommand(`npx create-next-app .${tsFlag} --skip-git`, projectDir);
                } else if (answers.frontendFramework === 'React') {
                    console.log(`Initializing Create React App in ${projectDir}...`);
                    runCommand(`npx create-react-app . --skip-git`, projectDir);
                } else if (answers.frontendFramework === 'Vite') {
                    console.log(`Initializing Vite app in ${projectDir}...`);
                    runCommand(`npx create-vite@latest . --template ${answers.frontendFramework} --skip-git`, projectDir);
                }
                overlayCustomFiles(answers, projectDir, 'web-app');
            }
        } else if (answers.projectType === 'API' || answers.projectType === 'CLI Tool') {
            await scaffoldSingleRepo(answers);
            const projectDir = path.join(process.cwd(), answers.projectName);
            const templateType = answers.projectType.toLowerCase();
            overlayCustomFiles(answers, projectDir, templateType);
        }

        // Prompt for Git repo creation
        const gitAnswer = await promptForGitRepo();
        if (gitAnswer.createGit) {
            // Initiate OAuth flow and obtain access token
            const accessToken = await initiateOAuthFlow();
            // Determine the target directory to push (for simplicity, assuming single repo case)
            let targetDir = '';
            if (answers.projectType === 'Web App') {
                if (answers.includeBackend) {
                    if (answers.repoStructure === 'Monorepo') {
                        targetDir = path.join(process.cwd(), answers.projectName);
                    } else {
                        // If separate repos, we can choose one or push both.
                        // Here we'll push the frontend repo as an example.
                        targetDir = path.join(process.cwd(), `${answers.projectName}-frontend`);
                    }
                } else {
                    targetDir = path.join(process.cwd(), answers.projectName);
                }
            } else {
                targetDir = path.join(process.cwd(), answers.projectName);
            }

            await createAndPushGitRepo(accessToken, answers.projectName, targetDir, answers.repoStructure);
        }
    } catch (error) {
        console.error('Error generating project:', error);
    }
}

main();
