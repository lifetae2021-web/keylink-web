import wave, struct, math

def make_wav(filename, freq, duration_sec):
    sample_rate = 44100.0
    obj = wave.open(filename, 'w')
    obj.setnchannels(1)
    obj.setsampwidth(2)
    obj.setframerate(sample_rate)
    
    for i in range(int(duration_sec * sample_rate)):
        # Fade out envelope
        envelope = max(0, 1 - (i / (duration_sec * sample_rate)))
        value = int(32767.0 * math.sin(2.0 * math.pi * freq * (i / sample_rate)) * envelope * 0.5)
        data = struct.pack('<h', value)
        obj.writeframesraw(data)
    obj.close()

make_wav('public/audio/presets/chime.wav', 880.0, 1.5)
make_wav('public/audio/presets/crystal.wav', 1200.0, 1.0)
make_wav('public/audio/presets/guide_1min.wav', 600.0, 2.0)
make_wav('public/audio/presets/guide_end.wav', 440.0, 2.5)
