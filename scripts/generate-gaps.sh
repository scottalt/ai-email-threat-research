#!/usr/bin/env bash
# Gap-fill generation for 1000-card v1 dataset
# Targets: 35 easy/medium/hard + 10 extreme per technique, 310 legit total
# Run after approving existing staging queue. Extras will be trimmed via SQL.
set -e

CMD="npx ts-node --project tsconfig.scripts.json scripts/generate-cards.ts"

run()  { echo ""; $CMD "$@"; }
runs() { echo ""; $CMD "$@" --model sonnet; }

# AUTHORITY-IMPERSONATION: need easy=8, medium=8, hard=3, extreme=5
echo "=== AUTHORITY-IMPERSONATION ==="
run  --technique authority-impersonation --difficulty easy    --count 5
run  --technique authority-impersonation --difficulty easy    --count 5
run  --technique authority-impersonation --difficulty medium  --count 5
run  --technique authority-impersonation --difficulty medium  --count 5
run  --technique authority-impersonation --difficulty hard    --count 5
runs --technique authority-impersonation --difficulty extreme --count 5

# CREDENTIAL-HARVEST: need easy=14, medium=16, hard=14, extreme=2
echo "=== CREDENTIAL-HARVEST ==="
run  --technique credential-harvest --difficulty easy   --count 5
run  --technique credential-harvest --difficulty easy   --count 5
runs --technique credential-harvest --difficulty easy   --count 5
run  --technique credential-harvest --difficulty medium --count 5
run  --technique credential-harvest --difficulty medium --count 5
run  --technique credential-harvest --difficulty medium --count 5
runs --technique credential-harvest --difficulty medium --count 5
run  --technique credential-harvest --difficulty hard   --count 5
run  --technique credential-harvest --difficulty hard   --count 5
runs --technique credential-harvest --difficulty hard   --count 5
runs --technique credential-harvest --difficulty extreme --count 3

# FLUENT-PROSE: need easy=10, medium=14, hard=14, extreme=1
echo "=== FLUENT-PROSE ==="
run  --technique fluent-prose --difficulty easy   --count 5
run  --technique fluent-prose --difficulty easy   --count 5
run  --technique fluent-prose --difficulty medium --count 5
run  --technique fluent-prose --difficulty medium --count 5
runs --technique fluent-prose --difficulty medium --count 5
run  --technique fluent-prose --difficulty hard   --count 5
run  --technique fluent-prose --difficulty hard   --count 5
runs --technique fluent-prose --difficulty hard   --count 5

# HYPER-PERSONALIZATION: need easy=12, medium=13, hard=13, extreme=2
echo "=== HYPER-PERSONALIZATION ==="
run  --technique hyper-personalization --difficulty easy   --count 5
run  --technique hyper-personalization --difficulty easy   --count 5
runs --technique hyper-personalization --difficulty easy   --count 5
run  --technique hyper-personalization --difficulty medium --count 5
run  --technique hyper-personalization --difficulty medium --count 5
runs --technique hyper-personalization --difficulty medium --count 5
run  --technique hyper-personalization --difficulty hard   --count 5
run  --technique hyper-personalization --difficulty hard   --count 5
runs --technique hyper-personalization --difficulty hard   --count 5
runs --technique hyper-personalization --difficulty extreme --count 3

# PRETEXTING: need easy=11, medium=10, hard=8, extreme=2
echo "=== PRETEXTING ==="
run  --technique pretexting --difficulty easy   --count 5
run  --technique pretexting --difficulty easy   --count 5
runs --technique pretexting --difficulty easy   --count 5
run  --technique pretexting --difficulty medium --count 5
run  --technique pretexting --difficulty medium --count 5
run  --technique pretexting --difficulty hard   --count 5
runs --technique pretexting --difficulty hard   --count 5
runs --technique pretexting --difficulty extreme --count 3

# URGENCY: need easy=15, medium=1, hard=14, extreme=1
echo "=== URGENCY ==="
run  --technique urgency --difficulty easy   --count 5
run  --technique urgency --difficulty easy   --count 5
runs --technique urgency --difficulty easy   --count 5
run  --technique urgency --difficulty medium --count 5
run  --technique urgency --difficulty hard   --count 5
run  --technique urgency --difficulty hard   --count 5
runs --technique urgency --difficulty hard   --count 5

# LEGIT: need ~77 more (generating 90 for buffer)
echo "=== LEGIT ==="
run  --category transactional --count 10
run  --category transactional --count 10
runs --category transactional --count 10
run  --category marketing     --count 10
run  --category marketing     --count 10
runs --category marketing     --count 10
run  --category workplace     --count 10
run  --category workplace     --count 10
runs --category workplace     --count 10

echo ""
echo "=== GAP FILL COMPLETE ==="
echo "Approve all staged cards then run trim SQL to normalize slot counts."
