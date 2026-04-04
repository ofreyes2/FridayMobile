import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { ACCENT_GREEN, ACCENT_BLUE, DARK_BG, HEADER_BG } from '@/constants/theme';

export default function EditorScreen() {
  const [filePath, setFilePath] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!filePath.trim()) {
      Alert.alert('Error', 'Please enter a file path');
      return;
    }

    setIsSaving(true);
    try {
      await api.writeFile(filePath, content);
      Alert.alert('Success', 'File saved successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setContent('');
    setFilePath('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Text style={styles.title}>EDITOR</Text>
        </View>

      <View style={styles.pathSection}>
        <Text style={styles.label}>File Path:</Text>
        <TextInput
          style={styles.pathInput}
          placeholder="/path/to/file.txt"
          placeholderTextColor="#666"
          value={filePath}
          onChangeText={setFilePath}
          editable={!isSaving}
        />
      </View>

      <View style={styles.editorSection}>
        <Text style={styles.label}>Content:</Text>
        <TextInput
          style={styles.contentInput}
          placeholder="Enter file content..."
          placeholderTextColor="#666"
          value={content}
          onChangeText={setContent}
          multiline
          editable={!isSaving}
        />
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            (!filePath.trim() || isSaving) && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={!filePath.trim() || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={ACCENT_GREEN} />
          ) : (
            <Text style={styles.buttonText}>Save</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={handleClear}
          disabled={isSaving}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
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
  pathSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: ACCENT_BLUE,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  pathInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
  },
  editorSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contentInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13,
  },
  buttonSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderTopColor: ACCENT_BLUE,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: ACCENT_GREEN,
  },
  clearButton: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
