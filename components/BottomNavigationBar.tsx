import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
} from 'react-native';

type TabType = 'home' | 'discover' | 'library' | 'new';

interface BottomNavigationBarProps {
  activeTab: TabType;
  onTabPress: (tab: TabType) => void;
  onHamburgerPress: () => void;
}

export function BottomNavigationBar({
  activeTab,
  onTabPress,
  onHamburgerPress,
}: BottomNavigationBarProps) {
  const isActive = (tab: TabType) => activeTab === tab;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onHamburgerPress}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, styles.hamburgerIcon]}>≡</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isActive('home') && styles.activeButton]}
        onPress={() => onTabPress('home')}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, isActive('home') && styles.activeIcon]}>⌂</Text>
        {isActive('home') && <View style={styles.activeIndicator} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isActive('discover') && styles.activeButton]}
        onPress={() => onTabPress('discover')}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, isActive('discover') && styles.activeIcon]}>⊘</Text>
        {isActive('discover') && <View style={styles.activeIndicator} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isActive('library') && styles.activeButton]}
        onPress={() => onTabPress('library')}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, isActive('library') && styles.activeIcon]}>⧉</Text>
        {isActive('library') && <View style={styles.activeIndicator} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, isActive('new') && styles.activeButton]}
        onPress={() => onTabPress('new')}
        activeOpacity={0.7}
      >
        <Text style={[styles.icon, isActive('new') && styles.activeIcon]}>✎</Text>
        {isActive('new') && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#12121A',
    borderTopWidth: 1,
    borderTopColor: '#1E1E2E',
    paddingBottom: 0,
    height: 60,
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  activeButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#00D4FF',
  },
  icon: {
    fontSize: 24,
    color: '#5A5A7A',
    fontWeight: '600',
  },
  activeIcon: {
    color: '#00D4FF',
  },
  hamburgerIcon: {
    fontSize: 26,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 2,
    backgroundColor: '#00D4FF',
  },
});
