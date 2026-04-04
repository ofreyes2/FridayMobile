// Voice input service
// Note: expo-speech-recognition requires native module compilation with expo prebuild
// When running in Expo Go, voice input will return empty (fallback to text mode)

export async function recordAndTranscribe(): Promise<string> {
  try {
    // Try to use expo-speech-recognition
    // This will only work when the app is built with: expo prebuild
    const SpeechRecognition = require('expo-speech-recognition');

    // Safely check if the module has the methods we need
    if (!SpeechRecognition?.startSpeechRecognitionAsync) {
      console.warn(
        'Voice input not available. Build with "expo prebuild" to enable speech recognition.'
      );
      return '';
    }

    const result = await SpeechRecognition.startSpeechRecognitionAsync();

    if (result?.error) {
      if (result.error === 'no_match') {
        throw new Error('No speech detected. Please try again.');
      }
      throw new Error(`Speech recognition error: ${result.error}`);
    }

    return result?.transcript || '';
  } catch (error) {
    // Gracefully fall back to text-only mode
    console.warn('Speech recognition unavailable. Using text mode.');
    return '';
  }
}
