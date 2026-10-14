# V109 — Width/Height Input Clearing Fix

- Width and height fields no longer immediately repopulate the old value when the user clears them to type a replacement.
- Clearing a field displays 0 as the starting value; entering a new number updates the selected element.
- Existing resize constraints still apply when a valid non-empty value is entered.
