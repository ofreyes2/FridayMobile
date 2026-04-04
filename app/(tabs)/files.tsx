import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/services/api';
import { ACCENT_GREEN, ACCENT_BLUE, DARK_BG, HEADER_BG } from '@/constants/theme';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

export default function FilesScreen() {
  const [rootPath, setRootPath] = useState('C:\\Friday');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleScan = async () => {
    if (!rootPath.trim()) {
      Alert.alert('Error', 'Please enter a root path');
      return;
    }

    setLoading(true);
    try {
      const result = await api.scanProject(rootPath);
      setFiles(result);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to scan project');
    } finally {
      setLoading(false);
    }
  };

  const handleFilePress = async (file: FileItem) => {
    if (file.type === 'directory') {
      Alert.alert('Info', 'Cannot open directories');
      return;
    }

    setSelectedFile(file);
    setContentLoading(true);
    try {
      const content = await api.readFile(file.path);
      setFileContent(content);
      setShowModal(true);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to read file');
    } finally {
      setContentLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FILES</Text>
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Root Path:</Text>
        <TextInput
          style={styles.input}
          placeholder="C:\Friday"
          placeholderTextColor="#666"
          value={rootPath}
          onChangeText={setRootPath}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleScan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={ACCENT_GREEN} />
          ) : (
            <Text style={styles.buttonText}>Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.filesList}>
        {files.map((file, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.fileItem,
              file.type === 'directory' && styles.directoryItem,
            ]}
            onPress={() => handleFilePress(file)}
          >
            <Text style={styles.fileIcon}>
              {file.type === 'directory' ? '📁' : '📄'}
            </Text>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{file.name}</Text>
              <Text style={styles.filePath}>{file.path}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {files.length === 0 && !loading && (
          <Text style={styles.emptyText}>Scan a directory to see files...</Text>
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedFile?.name}</Text>
            <View style={{ width: 60 }} />
          </View>

          {contentLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={ACCENT_GREEN} size="large" />
            </View>
          ) : (
            <ScrollView style={styles.contentContainer}>
              <Text style={styles.fileContentText}>{fileContent}</Text>
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
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
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: ACCENT_BLUE,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
    marginBottom: 8,
  },
  button: {
    backgroundColor: ACCENT_GREEN,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  filesList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT_BLUE + '66',
  },
  directoryItem: {
    backgroundColor: '#1A3A2A',
    borderColor: ACCENT_GREEN + '66',
  },
  fileIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  filePath: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
    paddingTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: ACCENT_BLUE,
    borderBottomWidth: 1,
  },
  closeButton: {
    color: ACCENT_GREEN,
    fontSize: 16,
    fontWeight: '600',
    width: 60,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  fileContentText: {
    color: ACCENT_GREEN,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});
