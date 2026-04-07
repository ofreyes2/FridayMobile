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
let isSpeakingFlag = false;

// Local TTS endpoints (KNIGHTSWATCH)
const LOCAL_TTS_ENDPOINTS = [
  'http://192.168.1.219:8082',   // Local network
  'http://100.112.253.127:8082', // Tailscale fallback
];

/**
 * Try local TTS service on KNIGHTSWATCH first.
 * Returns base64 WAV audio string if successful, null if failed.
 */
const tryLocalTTS = async (text: string): Promise<string | null> => {
  for (const endpoint of LOCAL_TTS_ENDPOINTS) {
    try {
      console.log(`[Voice] Trying local TTS at ${endpoint}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${endpoint}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Voice] Local TTS error ${response.status} from ${endpoint}`);
        continue;
      }

      // Response is raw WAV bytes — convert to base64
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      const base64Audio = btoa(binaryString);

      console.log(`[Voice] Local TTS success from ${endpoint} (${bytes.byteLength} bytes)`);
      return base64Audio;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[Voice] Local TTS failed at ${endpoint}: ${msg}`);
      continue;
    }
  }
  return null;
};

/**
 * Try ElevenLabs cloud TTS.
 * Returns base64 MPEG audio string if successful, null if failed.
 */
const tryElevenLabs = async (text: string): Promise<{ base64: string; mimeType: string } | null> => {
  if (typeof ELEVENLABS_API_KEY === 'string' && ELEVENLABS_API_KEY.includes('YOUR_API_KEY')) {
    return null;
  }

  try {
    console.log('[Voice] Trying ElevenLabs TTS...');
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
      console.error(`[Voice] ElevenLabs API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    const base64Audio = btoa(binaryString);

    console.log(`[Voice] ElevenLabs success (${bytes.byteLength} bytes)`);
    return { base64: base64Audio, mimeType: 'audio/mpeg' };
  } catch (error) {
    console.error('[Voice] ElevenLabs error:', error);
    return null;
  }
};

/**
 * Play base64 audio and wait for completion.
 */
const playBase64Audio = async (base64Audio: string, mimeType: string): Promise<void> => {
  const sound = new Audio.Sound();
  currentSound = sound;

  console.log('[Voice] Loading audio...');
  await sound.loadAsync({
    uri: `data:${mimeType};base64,${base64Audio}`,
  });

  console.log('[Voice] Playing audio...');
  await sound.playAsync();

  // Wait for audio to complete by polling playback status
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(async () => {
      try {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded || status.didJustFinish || !status.isPlaying) {
          clearInterval(checkInterval);
          resolve();
        }
      } catch (err) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Safety timeout - max 60 seconds of audio
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 60000);
  });

  console.log('[Voice] Audio playback completed');

  // Cleanup
  try {
    await sound.unloadAsync();
  } catch (err) {
    console.error('[Voice] Error unloading audio:', err);
  }
  currentSound = null;
};

export const speakWithFriday = async (text: string): Promise<void> => {
  if (!text || text.trim().length === 0) return;

  isSpeakingFlag = true;

  try {
    // Stop any currently playing audio
    if (currentSound) {
      try {
        await currentSound.stopAsync();
        await currentSound.unloadAsync();
      } catch (error) {
        console.error('[Voice] Error stopping previous audio:', error);
      }
      currentSound = null;
    }

    console.log('[Voice] Synthesizing:', text.substring(0, 50) + '...');

    // 1. Try local TTS first (KNIGHTSWATCH)
    const localAudio = await tryLocalTTS(text);
    if (localAudio) {
      try {
        await playBase64Audio(localAudio, 'audio/wav');
        return;
      } catch (error) {
        console.error('[Voice] Error playing local audio:', error);
        currentSound = null;
      }
    }

    // 2. Fall back to ElevenLabs
    const elevenLabsResult = await tryElevenLabs(text);
    if (elevenLabsResult) {
      try {
        await playBase64Audio(elevenLabsResult.base64, elevenLabsResult.mimeType);
        return;
      } catch (error) {
        console.error('[Voice] Error playing ElevenLabs audio:', error);
        currentSound = null;
      }
    }

    // 3. Final fallback to Moira
    console.log('[Voice] All TTS sources failed, using Moira fallback');
    await fallbackToMoira(text);
  } catch (error) {
    console.error('[Voice] Speech error:', error);
    await fallbackToMoira(text);
  } finally {
    isSpeakingFlag = false;
  }
};

const fallbackToMoira = async (text: string): Promise<void> => {
  try {
    console.log('[Voice] Using Moira fallback for speech');
    await Speech.speak(text, {
      language: 'en-IE',
      pitch: 1.15,
      rate: 0.90,
    } as any);
  } catch (error) {
    console.error('[Voice] Fallback speech error:', error);
  }
};

export const stopSpeaking = async (): Promise<void> => {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
    } catch (error) {
      console.error('[Voice] Error stopping audio:', error);
    }
    currentSound = null;
  }
  isSpeakingFlag = false;
};

export const isSpeaking = (): boolean => {
  return isSpeakingFlag || currentSound !== null;
};

export default speakWithFriday;
