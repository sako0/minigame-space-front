# Use the official Node.js image as the base image
FROM node:18.16.0

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN yarn build

# Expose the port the app will run on
EXPOSE 3000

# Start the app
CMD ["yarn", "start"]
