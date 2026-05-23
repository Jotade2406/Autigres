import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Animated, ActivityIndicator,
} from 'react-native';
import { Colors }  from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

// ── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  surf:       Colors.surface,
  card:       Colors.card,
  border:     Colors.border,
  primary:    Colors.primary,
  warning:    Colors.warning,
  hi:         Colors.textHigh,
  mid:        Colors.textMid,
  lo:         Colors.textLow,
  xs: Spacing.xs, sm: Spacing.sm, md: Spacing.md,
} as const;

const SCORES = [1, 2, 3, 4, 5] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RatingCardProps {
  targetName?: string;
  onSubmit: (score: 1 | 2 | 3 | 4 | 5, comment?: string) => Promise<void>;
  onSkip?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RatingCard({ targetName, onSubmit, onSkip }: RatingCardProps) {
  const [score,      setScore]      = useState<1 | 2 | 3 | 4 | 5>(5);
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);

  const starAnims = useRef(SCORES.map(() => new Animated.Value(1))).current;

  const handleStarPress = (s: typeof SCORES[number]) => {
    setScore(s);
    SCORES.forEach((star, i) => {
      if (star <= s) {
        Animated.sequence([
          Animated.spring(starAnims[i], { toValue: 1.4, useNativeDriver: true, tension: 220, friction: 5 }),
          Animated.spring(starAnims[i], { toValue: 1,   useNativeDriver: true, tension: 220, friction: 8 }),
        ]).start();
      } else {
        Animated.spring(starAnims[i], { toValue: 0.85, useNativeDriver: true, tension: 200, friction: 10 })
          .start(() => Animated.spring(starAnims[i], { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start());
      }
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(score, comment.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={S.card}>
      {targetName && <Text style={S.targetName}>{targetName}</Text>}

      {/* Animated stars */}
      <View style={S.starsRow}>
        {SCORES.map((s, i) => (
          <TouchableOpacity key={s} onPress={() => handleStarPress(s)} activeOpacity={0.7}>
            <Animated.Text
              style={[
                S.star,
                s <= score ? S.starOn : S.starOff,
                { transform: [{ scale: starAnims[i] }] },
              ]}
            >★</Animated.Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Optional comment */}
      <TextInput
        style={S.commentInput}
        placeholder="Comentario opcional..."
        placeholderTextColor={T.lo}
        value={comment}
        onChangeText={t => setComment(t.slice(0, 150))}
        multiline
        maxLength={150}
        returnKeyType="done"
      />
      <Text style={S.charCount}>{comment.length}/150</Text>

      {/* Submit */}
      <TouchableOpacity
        style={[S.submitBtn, submitting && S.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={S.submitBtnText}>Enviar calificación</Text>
        }
      </TouchableOpacity>

      {/* Skip */}
      {onSkip && (
        <TouchableOpacity style={S.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Text style={S.skipBtnText}>Ahora no</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: T.surf,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: T.md,
    alignItems: 'center',
    gap: T.sm,
  },
  targetName: { fontSize: 14, fontWeight: '600', color: T.mid },
  starsRow:   { flexDirection: 'row', gap: T.sm },
  star:       { fontSize: 40, lineHeight: 48 },
  starOn:     { color: T.warning },
  starOff:    { color: T.border },
  commentInput: {
    width: '100%',
    backgroundColor: T.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    padding: T.sm,
    color: T.hi,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  charCount:     { alignSelf: 'flex-end', fontSize: 11, color: T.lo },
  submitBtn:     { width: '100%', backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled:   { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  skipBtn:       { paddingVertical: T.xs },
  skipBtnText:   { fontSize: 14, fontWeight: '500', color: T.lo },
});
