import { useState, useRef, useCallback } from 'react';

const MAX_HISTORY = 80;
const DEBOUNCE_MS = 400;

/**
 * Strips volatile fields (like layoutTrigger timestamps) from a snapshot
 * so we can compare two snapshots for meaningful visual differences.
 */
function getFingerprint(snapshot) {
  const { layoutTrigger, ...rest } = snapshot;
  return JSON.stringify(rest);
}

/**
 * Drop-in replacement for useState that adds undo/redo history tracking.
 * 
 * Key design decisions:
 * - Deduplicates snapshots that differ only in volatile fields (layoutTrigger)
 * - Debounces rapid updates (drag at 60fps) into single history entries
 * - Structural changes (node/edge count, layout trigger) commit immediately
 * - Max 80 snapshots (~generous for diagram editing)
 * 
 * @param {object} initialState - Initial diagram data
 * @returns {{ state, setState, undo, redo, canUndo, canRedo }}
 */
export function useDiagramHistory(initialState) {
  const [state, setStateRaw] = useState(initialState);
  
  const historyRef = useRef([initialState]);
  const pointerRef = useRef(0);
  const lastCommitTimeRef = useRef(0);
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  // Commit a snapshot to history, deduplicating against current head
  const commit = useCallback((snapshot) => {
    const history = historyRef.current;
    const pointer = pointerRef.current;

    // Deduplicate: if the new snapshot is visually identical to current head, skip
    const currentFingerprint = getFingerprint(history[pointer]);
    const newFingerprint = getFingerprint(snapshot);
    if (currentFingerprint === newFingerprint) {
      // Still update the live state (layoutTrigger may have changed for renderer)
      // but don't pollute history with a no-op entry
      pendingRef.current = null;
      return;
    }

    // Discard any "future" entries after current pointer (branching)
    const trimmed = history.slice(0, pointer + 1);
    trimmed.push(snapshot);

    // Cap history length
    if (trimmed.length > MAX_HISTORY) {
      trimmed.shift();
    }

    historyRef.current = trimmed;
    pointerRef.current = trimmed.length - 1;
    lastCommitTimeRef.current = Date.now();
    pendingRef.current = null;
  }, []);

  // setState wrapper with debounce/throttle logic
  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;

      // Skip identity updates
      if (next === prev) return prev;

      // Heuristic: nodes/edges/groups count changed = structural change, commit now
      const countChanged = 
        (next.nodes?.length !== prev.nodes?.length) || 
        (next.edges?.length !== prev.edges?.length) ||
        (next.groups?.length !== prev.groups?.length);

      const now = Date.now();
      const elapsed = now - lastCommitTimeRef.current;

      if (countChanged || elapsed > DEBOUNCE_MS) {
        // Immediate commit (dedup will prevent empty entries)
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        commit(next);
      } else {
        // Debounce: schedule a commit after DEBOUNCE_MS
        pendingRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (pendingRef.current) {
            commit(pendingRef.current);
            pendingRef.current = null;
          }
          timerRef.current = null;
        }, DEBOUNCE_MS);
      }

      return next;
    });
  }, [commit]);

  const undo = useCallback(() => {
    // Flush any pending debounced commit first
    if (pendingRef.current) {
      commit(pendingRef.current);
      pendingRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    const pointer = pointerRef.current;
    if (pointer <= 0) return;

    const newPointer = pointer - 1;
    pointerRef.current = newPointer;
    const snapshot = historyRef.current[newPointer];
    lastCommitTimeRef.current = Date.now();
    setStateRaw(snapshot);
  }, [commit]);

  const redo = useCallback(() => {
    const pointer = pointerRef.current;
    const history = historyRef.current;
    if (pointer >= history.length - 1) return;

    const newPointer = pointer + 1;
    pointerRef.current = newPointer;
    const snapshot = history[newPointer];
    lastCommitTimeRef.current = Date.now();
    setStateRaw(snapshot);
  }, []);

  const canUndo = pointerRef.current > 0;
  const canRedo = pointerRef.current < historyRef.current.length - 1;

  return { state, setState, undo, redo, canUndo, canRedo };
}
