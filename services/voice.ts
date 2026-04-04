import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import {
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  ELEVENLABS_API_URL,
  ELEVENLABS_MODEL,
  VOICE_SETTINGS,
} from '@/constants/elevenlabs';

let currentSound: Audio.Sound | null = null;

export const speakWithFriday = async (text: string): Promise<void> => {
  if (!text || text.trim().length === 0) return;

  try {
    // Stop any currently playing audio
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (error) {
        console.error('Error stopping previous audio:', error);
      }
      currentSound = null;
    }

    // Check if API key is configured
    if (typeof ELEVENLABS_API_KEY === 'string' && ELEVENLABS_API_KEY.includes('YOUR_API_KEY')) {
      console.warn('ElevenLabs API key not configured. Falling back to Moira voice.');
      await fallbackToMoira(text);
      return;
    }

    // Fetch audio from ElevenLabs
    const response = await fetch(
      `${ELEVENLABS_API_URL}/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: VOICE_SETTINGS,
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `ElevenLabs API error: ${response.status} ${response.statusText}`
      );
      await fallbackToMoira(text);
      return;
    }

    // Convert response to base64
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64Audio = btoa(binaryString);

    // Play audio
    try {
      const sound = new Audio.Sound();
      currentSound = sound;

      await sound.loadAsync({
        uri: `data:audio/mpeg;base64,${base64Audio}`,
      });
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing audio:', error);
      await fallbackToMoira(text);
    }
  } catch (error) {
    console.error('ElevenLabs speech error:', error);
    // Fallback to Moira
    await fallbackToMoira(text);
  }
};

const fallbackToMoira = async (text: string): Promise<void> => {
  try {
    await Speech.speak(text, {
      language: 'en-IE',
      pitch: 1.15,
      rate: 0.90,
    } as any);
  } catch (error) {
    console.error('Fallback speech error:', error);
  }
};

export const stopSpeaking = async (): Promise<void> => {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
    currentSound = null;
  }
};

export const isSpeaking = (): boolean => {
  return currentSound !== null;
};

export default speakWithFriday;
