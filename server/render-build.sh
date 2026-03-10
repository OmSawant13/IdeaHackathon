#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Node.js dependencies
npm install

# Install Python and dependencies for Parler-TTS
# Note: Render's Python environment might need specific handling
# We use pip to install the requirements if a requirements.txt exists
# Or install them directly here for the hackathon
pip install torch parler-tts transformers soundfile
