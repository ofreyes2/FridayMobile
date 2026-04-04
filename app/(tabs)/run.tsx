import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { ACCENT_GREEN, ACCENT_BLUE, DARK_BG, HEADER_BG } from '@/constants/theme';

export default function RunScreen() {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [output]);

  const handleRun = async () => {
    if (!command.trim()) return;

    setLoading(true);
    try {
      const result = await api.run(command);
      setOutput(result);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setOutput('');
    setCommand('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>RUN COMMAND</Text>
        </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Command:</Text>
        <TextInput
          style={styles.commandInput}
          placeholder="Enter command to run..."
          placeholderTextColor="#666"
          value={command}
          onChangeText={setCommand}
          editable={!loading}
        />
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, !command.trim() && styles.buttonDisabled]}
            onPress={handleRun}
            disabled={loading || !command.trim()}
          >
            {loading ? (
              <ActivityIndicator color={ACCENT_GREEN} />
            ) : (
              <Text style={styles.buttonText}>Run</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={handleClear}
            disabled={loading}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.outputSection}>
        <Text style={styles.label}>Output:</Text>
        <ScrollView
          ref={scrollViewRef}
          style={styles.outputContainer}
          contentContainerStyle={styles.outputContent}
        >
          {output ? (
            <Text style={styles.outputText}>{output}</Text>
          ) : (
            <Text style={styles.emptyText}>Run a command to see output...</Text>
          )}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: ACCENT_BLUE,
    borderBottomWidth: 1,
    backgroundColor: HEADER_BG,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 3,
    color: ACCENT_GREEN,
    textTransform: 'uppercase',
  },
  inputSection: {
    padding: 16,
    borderBottomColor: ACCENT_BLUE,
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: ACCENT_BLUE,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  commandInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: ACCENT_GREEN,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  clearButton: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  outputSection: {
    flex: 1,
    padding: 16,
  },
  outputContainer: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
  },
  outputContent: {
    padding: 12,
  },
  outputText: {
    color: ACCENT_GREEN,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: 14,
  },
});
