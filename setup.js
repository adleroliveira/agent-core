// setup.js - Create this as a separate file
const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ 
  input: process.stdin, 
  output: process.stdout 
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));
const log = (color, message) => console.log(`\x1b[${color}m${message}\x1b[0m`);

async function setup() {
  if (!fs.existsSync('.env')) {
    if (!fs.existsSync('.env.example')) {
      log('33', 'ERROR: .env.example file not found!');
      process.exit(1);
    }
    log('33', 'Setting up environment variables from .env.example...');
    fs.copyFileSync('.env.example', '.env');
    log('32', 'Created .env file from template.');
    await setupAwsCredentials();
  } else {
    log('32', 'Using existing .env file...');
  }

  log('32', 'Building the application...');
  execSync('docker-compose build', { stdio: 'inherit' });
  
  log('32', 'Starting the application...');
  execSync('docker-compose up -d', { stdio: 'inherit' });
  
  log('32', 'Application is running at http://localhost:3000');
}

async function setupAwsCredentials() {
  log('33', 'Setting up AWS credentials...');
  const awsConfigPath = require('path').join(process.env.HOME || process.env.USERPROFILE, '.aws');
  const credentialsPath = require('path').join(awsConfigPath, 'credentials');
  const configPath = require('path').join(awsConfigPath, 'config');

  if (fs.existsSync(credentialsPath) || fs.existsSync(configPath)) {
    log('32', 'Found existing AWS profiles!');
    let profiles = [];
    
    if (fs.existsSync(credentialsPath)) {
      const credentials = fs.readFileSync(credentialsPath, 'utf8');
      const matches = credentials.match(/^\[(.*?)\]/gm);
      
      if (matches) {
        profiles = matches.map(profile => profile.replace(/[\[\]]/g, ''))
                          .filter(profile => profile !== 'default');
                          
        if (credentials.includes('[default]')) {
          profiles.unshift('default');
        }
      }
    }

    if (profiles.length > 0) {
      log('34', 'Available profiles:');
      profiles.forEach(profile => console.log(`  - ${profile}`));
      
      const profileChoice = await question('Enter profile name to use (or "manual" to enter credentials directly): ');
      
      if (profileChoice === 'manual') {
        await manualCredentials();
      } else {
        try {
          const region = execSync(`aws configure get region --profile ${profileChoice}`, { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
          }).trim() || 'us-east-1';
          
          let envContent = fs.readFileSync('.env', 'utf8');
          envContent = envContent.replace(/AWS_PROFILE=.*/, `AWS_PROFILE=${profileChoice}`);
          envContent = envContent.replace(/AWS_REGION=.*/, `AWS_REGION=${region}`);
          fs.writeFileSync('.env', envContent);
          
          log('32', `Profile '${profileChoice}' configured in .env file.`);
        } catch (error) {
          log('33', 'Error getting region from profile. Using manual credential entry.');
          await manualCredentials();
        }
      }
    } else {
      log('33', 'No named profiles found. Using manual credential entry.');
      await manualCredentials();
    }
  } else {
    log('33', 'No AWS config found. Please enter your AWS credentials manually:');
    await manualCredentials();
  }
}

async function manualCredentials() {
  const awsAccessKey = await question('AWS Access Key ID: ');
  const awsSecretKey = await question('AWS Secret Access Key: ');
  const awsRegion = await question('AWS Region (default: us-east-1): ') || 'us-east-1';
  
  let envContent = fs.readFileSync('.env', 'utf8');
  envContent = envContent.replace(/AWS_ACCESS_KEY_ID=.*/, `AWS_ACCESS_KEY_ID=${awsAccessKey}`);
  envContent = envContent.replace(/AWS_SECRET_ACCESS_KEY=.*/, `AWS_SECRET_ACCESS_KEY=${awsSecretKey}`);
  envContent = envContent.replace(/AWS_REGION=.*/, `AWS_REGION=${awsRegion}`);
  
  fs.writeFileSync('.env', envContent);
  log('32', 'AWS credentials saved to .env file.');
}

setup().then(() => rl.close());