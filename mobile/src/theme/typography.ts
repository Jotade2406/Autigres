import { Colors } from './colors';

export const Typography = {
  h1:      { fontSize: 28, fontWeight: '700' as const, color: Colors.textHigh },
  h2:      { fontSize: 20, fontWeight: '600' as const, color: Colors.textHigh },
  h3:      { fontSize: 16, fontWeight: '600' as const, color: Colors.textHigh },
  body:    { fontSize: 15, fontWeight: '400' as const, color: Colors.textMid },
  label:   { fontSize: 12, fontWeight: '500' as const, color: Colors.textLow, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  caption: { fontSize: 12, fontWeight: '400' as const, color: Colors.textLow },
};
