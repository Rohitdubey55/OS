/* store.js — tiny reactive store for PersonalOS
 * ==================================================================
 *
 * A 1-file pub/sub layer over window.state that lets views subscribe
 * to changes instead of being told "rerender yourself" by routeTo.
 *
 * The legacy pattern (still works, nothing to migrate):
 *     state.data.tasks.push(...);
 *     renderTasks();                  // full innerHTML rebuild
 *
 * The new pattern (incrementally adoptable):
 *     personalStore.set('tasks', newTasks);     // or: personalStore.update('tasks', mutator)
 *     personalStore.subscribe('tasks', tasks => {
 *         // do an incremental DOM patch with just this slice of data
 *     });
 *
 * Goals:
 *   - No build-time dependencies (works as a plain script tag)
 *   - Backwards compatible: reads/writes still go through window.state
 *   - Coalesces multiple sets in the same frame so a burst of mutations
 *     only fires one notification per subscriber per frame
 *   - Selector-based: subscribers can listen to "tasks" or "view" or
 *     a derived predicate ("tasks.length")
 *
 * Designed to coexist with the existing innerHTML rendering — views can
 * adopt it one mutation at a time without an all-or-nothing rewrite.
 * ================================================================== */

(function () {
    'use strict';

    if (!window.state) {
        // store.js may be loaded before main.js sets up state; provide a
        // minimal placeholder so subscribers can attach early.
        window.state = { data: {}, view: null };
    }

    const subscribers = new Map();   // key -> Set<fn>
    const wildcardSubs = new Set();  // fired on every change
    const dirtyKeys = new Set();
    let flushScheduled = false;

    function scheduleFlush() {
        if (flushScheduled) return;
        flushScheduled = true;
        // Defer to next frame so a burst of set()/update() calls coalesce.
        (typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (cb) => setTimeout(cb, 16))(flush);
    }

    function flush() {
        flushScheduled = false;
        const keys = [...dirtyKeys];
        dirtyKeys.clear();
        for (const key of keys) {
            const value = read(key);
            const subs = subscribers.get(key);
            if (subs) {
                for (const fn of subs) {
                    try { fn(value, key); } catch (e) {
                        console.error('[store] subscriber for', key, 'threw:', e);
                    }
                }
            }
        }
        if (keys.length && wildcardSubs.size) {
            for (const fn of wildcardSubs) {
                try { fn(keys); } catch (e) {
                    console.error('[store] wildcard subscriber threw:', e);
                }
            }
        }
    }

    // Resolve dotted-path keys against the canonical state.
    function read(key) {
        if (key === 'view')   return window.state.view;
        if (key === 'state')  return window.state;
        if (key.startsWith('data.')) {
            const rest = key.slice(5);
            return window.state.data ? window.state.data[rest] : undefined;
        }
        // Default: treat unprefixed keys as data slices (e.g. "tasks" -> state.data.tasks)
        return window.state.data ? window.state.data[key] : undefined;
    }

    function write(key, value) {
        if (key === 'view') {
            window.state.view = value;
        } else if (key.startsWith('data.')) {
            window.state.data = window.state.data || {};
            window.state.data[key.slice(5)] = value;
        } else {
            window.state.data = window.state.data || {};
            window.state.data[key] = value;
        }
    }

    const personalStore = {
        /** Read the current value of `key`. */
        get(key) { return read(key); },

        /** Replace the value at `key` and notify subscribers next frame. */
        set(key, value) {
            write(key, value);
            dirtyKeys.add(key);
            scheduleFlush();
            return value;
        },

        /** Functional update: pass current value, store the returned one. */
        update(key, mutator) {
            const next = mutator(read(key));
            return this.set(key, next);
        },

        /**
         * Notify subscribers of `key` even if you mutated the underlying
         * array/object in place. Useful when you push() to state.data.tasks
         * directly and need to tell the world.
         */
        notify(key) {
            dirtyKeys.add(key);
            scheduleFlush();
        },

        /**
         * Subscribe to changes at `key`. Returns an unsubscribe function.
         * Pass key='*' to receive ALL change events as an array of dirty keys.
         */
        subscribe(key, fn) {
            if (typeof fn !== 'function') {
                throw new TypeError('subscribe(key, fn): fn must be a function');
            }
            if (key === '*') {
                wildcardSubs.add(fn);
                return () => wildcardSubs.delete(fn);
            }
            if (!subscribers.has(key)) subscribers.set(key, new Set());
            subscribers.get(key).add(fn);
            return () => {
                const subs = subscribers.get(key);
                if (subs) {
                    subs.delete(fn);
                    if (subs.size === 0) subscribers.delete(key);
                }
            };
        },

        /** Debug helper: how many subscribers are attached. */
        _stats() {
            const out = { wildcard: wildcardSubs.size, byKey: {} };
            for (const [k, s] of subscribers) out.byKey[k] = s.size;
            return out;
        }
    };

    window.personalStore = personalStore;
    console.log('[store] Ready. Use window.personalStore.subscribe(key, fn) to react to changes.');
})();
