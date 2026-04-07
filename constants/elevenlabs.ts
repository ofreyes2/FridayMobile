// ElevenLabs Configuration
// Friday voice: warm, expressive, with personality

export const ELEVENLABS_API_KEY = 'sk_d1cde0c9d2b3fb8175864040b0fd0dbe7004d591db7f8309';
export const ELEVENLABS_VOICE_ID = 'CwhRBWXzygEQn7Q0OXyc'; // Rachel - warm, expressive female voice
export const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_MODEL = 'eleven_turbo_v2';

export const VOICE_SETTINGS = {
  stability: 0.65, // Slightly lower for more natural variation
  similarity_boost: 0.90, // High to keep voice consistent
  style: 0.85, // High expressiveness for personality and emotion
  use_speaker_boost: true,
};
