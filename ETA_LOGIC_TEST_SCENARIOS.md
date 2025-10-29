# ETA Calculation Logic - All Scenarios

## Current Time Reference: 15:15 (3:15 PM) or 03:15 (3:15 AM)

---

## Scenario 1: Normal API ETA (Realistic, Near Future)
**Input:**
- Current Time: `15:15` (915 min)
- API ETA: `15:45` (945 min)
- Speed: 80 km/h

**Calculation:**
- `minutesUntilArrival = 945 - 915 = 30` ✅
- `rawMinutesUntilArrival = 30` ✅
- NOT > 300 (5 hours) ❌
- NOT < -10 (past) ❌

**Result:** ✅ **Use API ETA** (`15:45`)
**Log:** `✅ Using API ETA for Train: 15:45`

---

## Scenario 2: API ETA Near Midnight (Day Wrap, Within 6 Hours)
**Input:**
- Current Time: `23:30` (1410 min)
- API ETA: `00:15` (15 min next day)
- Speed: 90 km/h

**Calculation:**
- `minutesUntilArrival = 15 - 1410 = -1395` 
- `rawMinutesUntilArrival = -1395`
- Within 6 hours of midnight? NO (-1395 < -360) ❌
- Trigger fallback? YES (< -10) ✅

**Sub-check (if calculated ETA available):**
- Calculated ETA: `00:20` (20 min)
- `calculatedMinutesUntilArrival = 20 - 1410 = -1390`
- Both in past? YES (both < -10) ✅

**Result:** ✅ **Use API ETA** (`00:15`) - Both ETAs show early arrival
**Log:** `ℹ️ Both API ETA (-1395 min ago) and Calculated ETA (-1390 min ago) are in the past - train arriving early, using API ETA`

**ISSUE FOUND:** This scenario is broken! API ETA `00:15` is actually 45 minutes in the FUTURE, not past!

---

## Scenario 3: API ETA Far Future (>5 Hours)
**Input:**
- Current Time: `15:15` (915 min)
- API ETA: `22:30` (1350 min)
- Speed: 100 km/h
- Distance: 50 km

**Calculation:**
- `minutesUntilArrival = 1350 - 915 = 435` 
- `rawMinutesUntilArrival = 435`
- > 300 (5 hours)? YES ✅
- Trigger fallback? YES ✅
- Calculate ETA: 50km ÷ 100km/h = 0.5h = 30min → `15:45`
- Scheduled time: `16:00` (960 min)

**Comparison:**
- `apiDiff = |1350 - 960| = 390`
- `calculatedDiff = |945 - 960| = 15`
- calculatedDiff < apiDiff? YES ✅

**Result:** ✅ **Use Calculated ETA** (`15:45`)
**Log:** `🔄 Using FALLBACK ETA for Train: 15:45 (API ETA: 22:30 was unrealistic)`

---

## Scenario 4: API ETA in Past, Calculated in Future (Your Bug Case)
**Input:**
- Current Time: `03:15` (195 min)
- API ETA: `02:26` (146 min)
- Speed: 95 km/h
- Distance: 19.5 km

**Calculation:**
- `minutesUntilArrival = 146 - 195 = -49`
- `rawMinutesUntilArrival = -49`
- < -10? YES ✅
- Trigger fallback? YES ✅
- Calculate ETA: 19.5km ÷ 95km/h = 0.21h ≈ 12min → `03:27`
- Calculated: `03:27` (207 min)
- `calculatedMinutesUntilArrival = 207 - 195 = 12` (future)

**Sub-check:**
- API in past? YES (-49 < -10) ✅
- Calculated in past? NO (12 > -10) ✅

**Result:** ✅ **Use Calculated ETA** (`03:27`)
**Log:** `⚠️ API ETA is in the past (-49 min ago) but calculated ETA is in future, forcing calculated ETA`

---

## Scenario 5: Both ETAs in Past (Early Arrival)
**Input:**
- Current Time: `10:30` (630 min)
- API ETA: `10:15` (615 min)
- Speed: 0 km/h (stopped)
- Calculated ETA: `10:20` (620 min)

**Calculation:**
- `minutesUntilArrival = 615 - 630 = -15`
- `rawMinutesUntilArrival = -15`
- < -10? YES ✅
- Calculate fallback (if moving): N/A (speed = 0)
- Use cached or calculate: Assume calculated = `10:20`
- `calculatedMinutesUntilArrival = 620 - 630 = -10`

**Sub-check:**
- API in past? YES (-15 < -10) ✅
- Calculated in past? YES (-10 <= -10) ✅ (edge case)

**Result:** ✅ **Use API ETA** (`10:15`) - Train already arrived
**Log:** `ℹ️ Both API ETA (-15 min ago) and Calculated ETA (-10 min ago) are in the past - train arriving early, using API ETA`

---

## Scenario 6: Train Stopped (Use Cached ETA)
**Input:**
- Current Time: `14:30` (870 min)
- API ETA: `20:00` (1200 min)
- Speed: 0 km/h
- Cached ETA: `15:00` (900 min)
- Cached Speed: 80 km/h

**Calculation:**
- `minutesUntilArrival = 1200 - 870 = 330`
- > 300? YES ✅
- Speed = 0? YES ✅
- `shouldWaitForSpeedRecovery = true` ✅
- Has cached ETA? YES ✅
- Cached ETA valid? `900 - 870 = 30` (future) ✅

**Result:** ✅ **Use Cached ETA** (`15:00`)
**Log:** 
- `🛑 Train stopped (0 km/h), using cached ETA until speed recovers`
- `♻️ Reusing cached ETA for Train: 15:00`

---

## Scenario 7: Speed Decreasing >20% (Use Cached ETA)
**Input:**
- Current Time: `12:00` (720 min)
- API ETA: `18:00` (1080 min)
- Speed: 50 km/h
- Cached Speed: 90 km/h
- Cached ETA: `13:00` (780 min)

**Calculation:**
- `minutesUntilArrival = 1080 - 720 = 360`
- > 300? YES ✅
- Speed drop: `90 - 50 = 40 km/h`
- Speed drop %: `(40/90)*100 = 44%` > 20% ✅
- `shouldWaitForSpeedRecovery = true` ✅
- Cached ETA valid? `780 - 720 = 60` (future) ✅

**Result:** ✅ **Use Cached ETA** (`13:00`)
**Log:**
- `📉 Speed decreasing (90 → 50 km/h, 44% drop), using cached ETA`
- `♻️ Reusing cached ETA for Train: 13:00`

---

## Scenario 8: Midnight Crossing (Within 6 Hours)
**Input:**
- Current Time: `23:50` (1430 min)
- API ETA: `00:20` (20 min next day)
- Speed: 60 km/h

**Calculation:**
- `minutesUntilArrival = 20 - 1430 = -1410`
- `rawMinutesUntilArrival = -1410`
- Within 6 hours? `-1410 > -360`? NO ❌
- So NO day wrap applied
- < -10? YES ✅
- Trigger fallback? YES ✅

**ISSUE:** Day wrap logic should apply here! This is a MIDNIGHT CROSSING case.

---

## ISSUES FOUND:

### Issue 1: Day Wrap Logic Too Restrictive
**Problem:** Line 2949: `if (minutesUntilArrival < 0 && minutesUntilArrival > -360)`

This only handles day wrap if difference is 0 to -360 minutes (-6 hours). But for:
- Current: `23:50` (1430 min)
- ETA: `00:20` (20 min)
- Difference: `-1410 minutes`

This should be: `1440 - 1430 + 20 = 30 minutes` (future)

**Fix Needed:** Detect midnight crossing differently:
```javascript
// If ETA is small (< 360 = 6AM) and current time is large (> 1080 = 6PM), it's next day
if (apiETAMinutes < 360 && currentMinutes > 1080) {
    minutesUntilArrival += 1440;
}
```

### Issue 2: Edge Case at -10 Minutes
**Problem:** Line 3040: `if (calculatedMinutesUntilArrival < -10)`

Should this be `<= -10` or `< -10`? Currently -10 exactly is treated as "not in past"

---

## RECOMMENDED FIXES:

1. **Fix day wrap detection** to properly handle midnight crossing
2. **Add more detailed logging** for each decision point
3. **Consider edge case** at exactly -10 minutes threshold


