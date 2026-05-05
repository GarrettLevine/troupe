Add a production Dockerfile to packages/server for Cloud Run deployment.

## Requirements
- Base image: node:20-alpine
- Working directory: /app
- Install only production dependencies
- Compile TypeScript to dist/ before building the image
- App must listen on PORT environment variable, defaulting to 8080 
  (Cloud Run requirement)
- Use a .dockerignore file to exclude node_modules, src/, and .env files
- The final image should be as small as possible — use multi-stage build:
  Stage 1 (builder): install all deps, compile TypeScript
  Stage 2 (production): copy only dist/ and production node_modules

## .dockerignore
Create packages/server/.dockerignore excluding:
  node_modules/
  dist/
  .env
  .env.*
  src/
  tsconfig.json

## Verify
Confirm the app starts cleanly with:
  docker build -t troupe-api ./packages/server
  docker run -p 8080:8080 --env-file packages/server/.env troupe-api