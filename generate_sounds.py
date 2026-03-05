import math
import wave
import struct
import os
import shutil

def generate_tone(filename, frequency, duration_sec, volume=0.5, modulation=None):
    sample_rate = 44100
    num_samples = int(sample_rate * duration_sec)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1) # mono
        wav_file.setsampwidth(2) # 2 bytes per sample
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            t = float(i) / sample_rate
            freq = frequency
            vol = volume
            
            if modulation == 'sweep':
                # Sweeping up
                freq = frequency + (500 * t/duration_sec)
                env = math.exp(-2.0 * t / duration_sec)
                vol = volume * env
            elif modulation == 'pulse':
                # Beeping
                vol = volume if (int(t * 8) % 2 == 0) else 0.0
            elif modulation == 'two_tone':
                # Ding-dong style
                freq = frequency if t < (duration_sec/2) else frequency * 0.8
                env = math.exp(-3.0 * (t % (duration_sec/2)) / (duration_sec/2))
                vol = volume * env
            else:
                # Basic fade out
                env = math.exp(-3.0 * t / duration_sec)
                vol = volume * env
                
            value = int(vol * 32767.0 * math.sin(2.0 * math.pi * freq * t))
            # clamp
            value = max(-32768, min(32767, value))
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)

os.makedirs('android/app/src/main/res/raw', exist_ok=True)
os.makedirs('ios/App/App/Sounds', exist_ok=True)
os.makedirs('www/assets/sounds', exist_ok=True)

# Generate 3 distinct tones
generate_tone('android/app/src/main/res/raw/chime.wav', 880, 2.0, modulation='sweep')
generate_tone('android/app/src/main/res/raw/beep.wav', 1200, 1.0, modulation='pulse')
generate_tone('android/app/src/main/res/raw/classic.wav', 1046, 2.0, modulation='two_tone')

# copy to iOS and Web
for f in ['chime.wav', 'beep.wav', 'classic.wav']:
    src = os.path.join('android/app/src/main/res/raw', f)
    shutil.copy(src, os.path.join('ios/App/App/Sounds', f))
    shutil.copy(src, os.path.join('www/assets/sounds', f))

print("Successfully generated custom notification sounds!")
