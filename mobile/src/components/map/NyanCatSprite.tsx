import React, { useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';

const FRAME_W     = 101;
const FRAME_H     = 64;
const FRAME_COUNT = 8;
const FRAME_MS    = 100;
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
    <View style={{ width: FRAME_W, height: FRAME_H, overflow: 'hidden' }}>
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
