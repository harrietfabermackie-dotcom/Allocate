# Morning Sequence Implementation: What Went Wrong?

## Overview
The morning sequence was designed to show a Stardew Valley-inspired opening screen when the app is first opened each day (after 3am). However, it never worked reliably and was eventually reverted.

---

## Root Causes

### 1. **Fundamental Architecture Conflict** 🔴 **CRITICAL**

**The Problem:**
- The app's initialization flow was: `DOM loads → render() immediately → show app`
- The morning sequence needed: `DOM loads → check if first open → IF YES: show morning screen → hide app → wait for close → THEN render()`

**Why This Failed:**
- We tried to insert a "pre-render" screen into an app designed to render immediately
- `render()` was called at the end of the script regardless of morning screen state
- This created a race condition: the app would start rendering while the morning screen was supposed to be showing

**Example of the conflict:**
```javascript
// Original code (end of script):
renderPresetTiles();
renderStatsView(false);
render(); // <-- This ALWAYS runs, showing the app

// What we tried:
setTimeout(() => {
  if(checkFirstOpenToday()){
    showMorningScreen(); // <-- Try to show morning screen
  } else {
    render(); // <-- But render() already ran above!
  }
}, 100);
```

**The Fix Needed:**
- Should have made `render()` conditional: only call it if morning screen won't show
- OR: Make morning screen check synchronous and block rendering

---

### 2. **Race Condition with Render Cycle** 🔴 **CRITICAL**

**The Problem:**
- `render()` was called unconditionally at initialization
- `checkFirstOpenToday()` was called in a `setTimeout` delay
- Result: App renders first, then morning screen check happens

**Timeline of what actually happened:**
1. Script loads
2. `render()` executes immediately → app appears
3. `setTimeout` callback runs (100ms later)
4. `checkFirstOpenToday()` runs
5. `showMorningScreen()` tries to show → but app is already visible

**Why setTimeout made it worse:**
- Added arbitrary delay that didn't guarantee DOM readiness
- Created a window where the app could render before morning screen
- Made debugging harder because timing was unpredictable

---

### 3. **State Management Complexity** 🟡 **MEDIUM**

**The Problem:**
- `checkFirstOpenToday()` depended on:
  - `dayKeyWithCutoff()` function (which uses 3am cutoff logic)
  - `LS_LAST_MORNING` localStorage key
  - Current time being >= 3am
  - Comparison with stored last-seen date

**Complex logic chain:**
```javascript
checkFirstOpenToday() 
  → dayKeyWithCutoff(now) // Complex 3am cutoff logic
  → loadJSON(LS_LAST_MORNING, null) // Read from localStorage
  → Compare dates
  → Save new date
  → Return boolean
```

**Why this was fragile:**
- Multiple failure points (time check, localStorage read, date comparison)
- Edge cases (exactly at 3am, timezone issues, date rollover)
- No clear error handling if any step failed

---

### 4. **DOM Readiness Assumptions** 🟡 **MEDIUM**

**The Problem:**
- Assumed DOM would be ready when functions executed
- Used `setTimeout` as a band-aid for DOM readiness
- Morning screen HTML existed, but event listeners might attach before elements exist

**Issues:**
- `el('morningScreen')` could return `null` if DOM not ready
- Event listeners attached to elements that might not exist yet
- `showMorningScreen()` tried to manipulate DOM that might not be ready

**Why setTimeout failed:**
- Arbitrary delays don't guarantee DOM readiness
- Different devices/browsers have different render speeds
- Still had timing issues even with delays

---

### 5. **Render Cycle Interference** 🟡 **MEDIUM**

**The Problem:**
- `render()` was called from multiple places:
  - Initial load
  - After closing morning screen
  - After various user actions
- Morning screen needed to prevent `render()` but couldn't control all call sites

**Specific issue:**
- Even if morning screen showed successfully, any subsequent `render()` call would hide it
- `closeMorningScreen()` called `render()` at the end, but the screen might have been closed/hidden already

---

### 6. **Reset Button Hijacking** 🟡 **MEDIUM**

**The Problem:**
- Changed reset button from "clear all data" to "show morning screen"
- Broke expected behavior of existing feature
- Event listener had issues (initially tried direct attachment, then switched to delegation)

**Why the reset button didn't work:**
- Event listener attachment issues (element not found, timing problems)
- Original reset functionality was removed, confusing behavior
- Tried to use reset button as a workaround instead of fixing root issue

---

### 7. **Multiple Failure Points** 🟡 **MEDIUM**

**The Problem:**
- Morning screen could fail silently at multiple points:
  1. `checkFirstOpenToday()` could return false (already seen today)
  2. `showMorningScreen()` could fail (DOM not ready, element not found)
  3. Event listeners might not attach (elements not ready)
  4. `closeMorningScreen()` might not work (event listener issues)

**Why it was hard to debug:**
- No clear error messages
- Silent failures at multiple stages
- Hard to know which part failed
- User would just see the normal app and assume nothing happened

---

### 8. **No Graceful Fallback** 🟢 **LOW**

**The Problem:**
- If morning screen failed to show, app would render normally
- No indication to user that something was supposed to happen
- No error logging or fallback behavior

---

## Architectural Lessons

### What We Should Have Done:

1. **Make rendering conditional:**
```javascript
// Should have been:
if(checkFirstOpenToday()){
  showMorningScreen();
  // DON'T call render() here
} else {
  render(); // Only render if not showing morning screen
}
```

2. **Block rendering until morning screen decides:**
   - Check immediately (synchronously)
   - If morning screen needed, don't call `render()`
   - Only call `render()` after morning screen closes

3. **Simplify state management:**
   - Single source of truth for "should show morning screen"
   - Clear, linear flow: check → show → close → render

4. **Proper DOM readiness:**
   - Use `DOMContentLoaded` event or check element existence
   - Don't rely on arbitrary `setTimeout` delays

5. **Better error handling:**
   - Clear console logs
   - Fallback to normal render if morning screen fails
   - User-visible errors if needed

---

## Key Insight

**The fundamental issue:** We tried to add a "pre-render" screen to an app that was architected to render immediately. This required changing the initialization flow, which touched many interconnected parts of the app.

**Better approach would have been:**
- Design the initialization flow from the start to support conditional rendering
- OR: Make morning screen part of the normal render cycle (as a modal/overlay that renders first)
- OR: Check for morning screen synchronously and block initialization until decision is made

---

## Summary

**Primary Failure Points:**
1. ❌ Architecture conflict: immediate render vs. conditional render
2. ❌ Race condition: setTimeout vs. immediate render()
3. ❌ State complexity: multiple dependencies for "should show" check
4. ❌ DOM timing: assumptions about readiness

**Why it kept failing:**
- Each fix addressed symptoms, not root cause
- Race condition persisted because render() always ran
- Timing issues compounded each other

**What would have worked:**
- Conditional initialization: only render if morning screen won't show
- Synchronous check: no setTimeout delays
- Clear state management: single source of truth
- Proper error handling: fallback behavior
