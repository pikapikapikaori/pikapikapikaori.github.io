FROM node:latest
LABEL description="Dockerfile for build PersonalBlog."
WORKDIR /docs
RUN npm install -g docsify-cli@latest
EXPOSE 3000/tcp
ENTRYPOINT docsify serve .