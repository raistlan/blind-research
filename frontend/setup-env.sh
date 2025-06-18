#!/bin/bash

# Check if OPENAI_API_KEY is provided as an argument
if [ -z "$1" ]; then
    echo "Please provide your OpenAI API key as an argument"
    echo "Usage: ./setup-env.sh your-api-key-here"
    exit 1
fi

# Create or update .env file
echo "OPENAI_API_KEY=$1" > .env
echo "Environment variable has been set in .env file" 