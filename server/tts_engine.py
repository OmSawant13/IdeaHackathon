import torch
from parler_tts import ParlerTTSForConditionalGeneration
from transformers import AutoTokenizer
import soundfile as sf
import sys
import os
import base64
import io

device = "cuda:0" if torch.cuda.is_available() else "cpu"
if torch.backends.mps.is_available():
    device = "mps"

model_name = "parler-tts/parler-tts-mini-v1"
model = ParlerTTSForConditionalGeneration.from_pretrained(model_name, torch_dtype=torch.float16).to(device)
tokenizer = AutoTokenizer.from_pretrained(model_name)

def generate_tts(text, description="A female speaker delivers a slightly expressive and animated talk with a moderate speed and pitch. The recording is of very high quality, with the speaker's voice sounding clear and helpfull."):
    input_ids = tokenizer(description, return_tensors="pt").input_ids.to(device)
    prompt_input_ids = tokenizer(text, return_tensors="pt").input_ids.to(device)

    generation = model.generate(input_ids=input_ids, prompt_input_ids=prompt_input_ids)
    audio_arr = generation.cpu().numpy().squeeze()
    
    # Save to a buffer
    buffer = io.BytesIO()
    sf.write(buffer, audio_arr, model.config.sampling_rate, format='wav')
    buffer.seek(0)
    
    # Encode to base64
    return base64.b64encode(buffer.read()).decode('utf-8')

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tts_engine.py <text> [description]")
        sys.exit(1)
    
    text = sys.argv[1]
    description = sys.argv[2] if len(sys.argv) > 2 else "A female speaker delivers a slightly expressive and animated talk with a moderate speed and pitch. The recording is of very high quality, with the speaker's voice sounding clear and helpfull."
    
    try:
        b64_audio = generate_tts(text, description)
        print(f"DATA_START{b64_audio}DATA_END")
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)
