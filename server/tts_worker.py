import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
import soundfile as sf
import sys
import os
import base64
import io
import json

# Setup device
device = "cuda:0" if torch.cuda.is_available() else "cpu"
if torch.backends.mps.is_available():
    device = "mps"

print(f"DEBUG: Using device: {device}", file=sys.stderr)

# Load model once
model_name = "parler-tts/parler-tts-mini-v1"
print(f"DEBUG: Loading model {model_name}...", file=sys.stderr)
model = ParlerTTSForConditionalGeneration.from_pretrained(model_name, torch_dtype=torch.float16).to(device)
tokenizer = AutoTokenizer.from_pretrained(model_name)
print("READY", file=sys.stderr) # Signal to Node.js that we are ready

def generate_tts(text, description):
    input_ids = tokenizer(description, return_tensors="pt").input_ids.to(device)
    prompt_input_ids = tokenizer(text, return_tensors="pt").input_ids.to(device)

    # Simplified generation for speed
    generation = model.generate(
        input_ids=input_ids, 
        prompt_input_ids=prompt_input_ids,
        do_sample=True,
        temperature=1.0, 
        min_new_tokens=10
    )
    audio_arr = generation.cpu().numpy().squeeze()
    
    # Save to a buffer
    buffer = io.BytesIO()
    sf.write(buffer, audio_arr, model.config.sampling_rate, format='wav')
    buffer.seek(0)
    
    return base64.b64encode(buffer.read()).decode('utf-8')

# Persistent Loop
default_desc = "A female speaker delivers a slightly expressive and animated talk with a moderate speed and pitch. The recording is of very high quality, with the speaker's voice sounding clear and helpfull."

for line in sys.stdin:
    try:
        data = json.loads(line)
        text = data.get("text", "")
        description = data.get("description", default_desc)
        
        if not text:
            continue
            
        b64_audio = generate_tts(text, description)
        # Final output
        print(json.dumps({"status": "success", "audio": b64_audio}))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.stdout.flush()
