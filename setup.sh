#!/bin/bash

echo "🚀 NL→SQL App Setup"
echo "==================="

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required (found v$NODE_VERSION)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
npm -w server install
npm -w client install

# Setup environment
if [ ! -f ".env" ]; then
    echo ""
    echo "🔧 Creating .env file..."
    cp .env.example .env

    echo ""
    echo "📝 OpenAI API Setup (optional)"
    echo "To use OpenAI for NL→SQL translation:"
    echo "1. Edit .env"
    echo "2. Add your OPENAI_API_KEY"
    echo ""
    echo "The app will work without it using rule-based translation."
fi

# Build the application
echo ""
echo "🏗️  Building application..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the application:"
echo "  Development: npm run dev"
echo "  Production:  npm start"
echo ""
echo "To run tests:"
echo "  npm -w server run test"
echo ""
echo "Access the app at:"
echo "  Frontend: http://localhost:5173 (dev mode)"
echo "  API:      http://localhost:3001"