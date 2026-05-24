import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const VIDEO_URL =
  'https://drive.google.com/uc?export=download&id=1BR9h8A2V3UMDv1-umlsFByrJYvKbtVI6';

interface Props {
  onFinished: () => void;
}

export function IntroScreen({ onFinished }: Props) {
  const player = useVideoPlayer(VIDEO_URL, (p) => {
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onFinished);
    return () => sub.remove();
  }, [player, onFinished]);

  // Tap anywhere para saltar
  return (
    <TouchableOpacity style={styles.container} onPress={onFinished} activeOpacity={1}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="cover"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
});
