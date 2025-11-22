#!/bin/bash

# Ensure we are in the script's directory
cd "$(dirname "$0")"

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Starting Fiber Chat Server..."
node server.js
