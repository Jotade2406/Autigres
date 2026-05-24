import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

const FRAME_W     = 117;
const FRAME_H     = 72;
const FRAME_COUNT = 12;
const FRAME_MS    = 70;
const SHEET_W     = FRAME_W * FRAME_COUNT;

const SHEET = require('../../../assets/nyancat/nyancat_sheet.png');

export function NyanCatSprite() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setFrame(f => (f + 1) % FRAME_COUNT),
      FRAME_MS,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <View style={{ width: FRAME_W, height: FRAME_H, overflow: 'hidden', backgroundColor: 'transparent' }}>
      <Image
        source={SHEET}
        style={{
          width: SHEET_W,
          height: FRAME_H,
          transform: [{ translateX: -frame * FRAME_W }],
        }}
        resizeMode="cover"
      />
    </View>
  );
}
