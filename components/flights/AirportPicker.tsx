import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchAirports, getAirport, type Airport } from '@/services/flights';

interface Props {
  label: string;
  value: string; // airport code, or '' for anywhere
  onChange: (code: string) => void;
  allowAnywhere?: boolean;
  placeholder?: string;
}

export function AirportPicker({
  label,
  value,
  onChange,
  allowAnywhere = false,
  placeholder = 'Select airport',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchAirports(query, 20), [query]);
  const selected = value ? getAirport(value) : undefined;
  const displayText = selected
    ? `${selected.city} (${selected.code})`
    : value === '' && allowAnywhere
    ? 'Anywhere'
    : placeholder;

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !selected && value !== '' && styles.placeholder]}>
          {displayText}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search city or airport code"
              placeholderTextColor="#5A5A7A"
              autoFocus
              autoCapitalize="characters"
            />
            {allowAnywhere ? (
              <Pressable style={styles.row} onPress={() => pick('')}>
                <Text style={styles.rowCode}>🌎</Text>
                <View style={styles.rowBody}>
                  <Text style={styles.rowCity}>Anywhere</Text>
                  <Text style={styles.rowName}>Search all destinations</Text>
                </View>
              </Pressable>
            ) : null}
            <FlatList
              data={results}
              keyExtractor={(a: Airport) => a.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => pick(item.code)}>
                  <Text style={styles.rowCode}>{item.code}</Text>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowCity}>{item.city}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={styles.rowRegion}>{item.region}</Text>
                </Pressable>
              )}
              style={styles.list}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  label: { color: '#8888AA', fontSize: 12, marginBottom: 6, fontWeight: '600' },
  field: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  placeholder: { color: '#5A5A7A', fontWeight: '400' },
  chevron: { color: '#5A5A7A', fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0A0A0F',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#1E1E2E',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  close: { color: '#8888AA', fontSize: 18 },
  search: {
    backgroundColor: '#12121A',
    borderWidth: 1,
    borderColor: '#1E1E2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 8,
  },
  list: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1E1E2E',
    gap: 12,
  },
  rowCode: { color: '#00D4FF', fontSize: 15, fontWeight: '800', width: 44 },
  rowBody: { flex: 1 },
  rowCity: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  rowName: { color: '#5A5A7A', fontSize: 12, marginTop: 1 },
  rowRegion: { color: '#5A5A7A', fontSize: 11 },
});
