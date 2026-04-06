#!/usr/bin/env bash
# Generate ~1000 v2 cards directly into freeplay + roguelike pools
#
# Distribution:
#   Phishing: 6 techniques × 4 difficulties × 10 cards = 240 phishing
#   Legit:    3 categories × 4 difficulties × 10 cards = 120 legit
#   Total per round: 360 cards
#   Run 3 rounds with different industries for ~1080 cards
#
# Usage:
#   bash scripts/generate-batch.sh              # live run
#   bash scripts/generate-batch.sh --dry-run    # preview only
#
# Prerequisites:
#   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local

set +e  # continue on individual batch failures

EXTRA="$@"
POOL="freeplay"
CMD="npx ts-node --project tsconfig.scripts.json scripts/generate-cards.ts"
TECHNIQUES=("urgency" "authority-impersonation" "credential-harvest" "hyper-personalization" "pretexting" "fluent-prose")
CATEGORIES=("transactional" "marketing" "workplace")

echo "=== v2 Card Generation (direct → $POOL) ==="
echo "Extra flags: $EXTRA"
echo ""

# ── Phishing: easy/medium with haiku, hard/extreme with sonnet ──
for t in "${TECHNIQUES[@]}"; do
  for d in easy medium; do
    echo ">>> Phishing: $t / $d (haiku)"
    $CMD --technique "$t" --difficulty "$d" --count 10 \
      --provider anthropic --model haiku --direct --pool "$POOL" $EXTRA
    sleep 1
  done
  for d in hard extreme; do
    echo ">>> Phishing: $t / $d (sonnet)"
    $CMD --technique "$t" --difficulty "$d" --count 10 \
      --provider anthropic --model sonnet --direct --pool "$POOL" $EXTRA
    sleep 1
  done
done

# ── Legit: easy/medium with haiku, hard/extreme with sonnet ──
for c in "${CATEGORIES[@]}"; do
  for d in easy medium; do
    echo ">>> Legit: $c / $d (haiku)"
    $CMD --category "$c" --difficulty "$d" --count 10 \
      --provider anthropic --model haiku --direct --pool "$POOL" $EXTRA
    sleep 1
  done
  for d in hard extreme; do
    echo ">>> Legit: $c / $d (sonnet)"
    $CMD --category "$c" --difficulty "$d" --count 10 \
      --provider anthropic --model sonnet --direct --pool "$POOL" $EXTRA
    sleep 1
  done
done

echo ""
echo "=== Phase 1 complete: ~360 cards in freeplay ==="
echo ""
echo "To copy into roguelike pool, run in Supabase SQL editor:"
echo ""
echo "INSERT INTO cards_generated (card_id, pool, type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status)"
echo "SELECT 'rl-' || card_id, 'roguelike', type, is_phishing, difficulty, from_address, subject, body, clues, explanation, highlights, technique, auth_status"
echo "FROM cards_generated"
echo "WHERE pool = 'freeplay' AND card_id LIKE 'gen-%'"
echo "ON CONFLICT (card_id) DO NOTHING;"
echo ""
echo "Run this script 3x for ~1000 cards (industries are randomized each run)."
echo "=== Done ==="
