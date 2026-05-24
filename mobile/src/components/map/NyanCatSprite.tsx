import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

// Sprite sheet dimensions (actual PNG pixels)
const FRAME_W     = 117;
const FRAME_H     = 72;
const FRAME_COUNT = 12;
const FRAME_MS    = 70;
const SHEET_W     = FRAME_W * FRAME_COUNT;

// Display size on map — match original emoji (~28px tall)
const DISP_H = 28;
const DISP_W = Math.round(FRAME_W * (DISP_H / FRAME_H)); // ~45px

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
    <View style={{ width: DISP_W, height: DISP_H, overflow: 'hidden', backgroundColor: 'transparent' }}>
      <Image
        source={SHEET}
        style={{
          width: SHEET_W * (DISP_W / FRAME_W),
          height: DISP_H,
          transform: [{ translateX: -frame * DISP_W }],
        }}
        resizeMode="cover"
      />
    </View>
  );
}
