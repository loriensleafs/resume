### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it justified?
- Does it maintain clean module boundaries?
- Are dependencies flowing in the right direction (no circular dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too coupled)?
- **Does this refactor reduce complexity or just relocate it?** Count the concepts a reader must hold to follow the change. If a "cleaner" version leaves that count unchanged, it isn't cleaner. Prefer the restructuring that makes whole branches, modes, or layers disappear over one that re-centralizes the same logic. Prefer deleting an abstraction to polishing it.
- **Is feature-specific logic leaking into a shared or general-purpose module?** Keep logic in its owning layer, reuse the existing canonical helper instead of a near-duplicate, and don't normalize architectural drift.
- **Are type boundaries explicit?** Question gratuitous `any`/`unknown`/optional/casts and silent fallbacks that paper over an unclear invariant. Making the boundary explicit often makes the surrounding control flow simpler.

**The smell baseline.** Match each of these twelve smells (Fowler, _Refactoring_, ch. 3) against the diff. Each reads *what it is* then *how to fix it*. Name the smell and quote the hunk when you report one.

- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. Fix: rename it; if no honest name comes, the design is murky.
- **Duplicated Code**: the same logic shape appears in more than one hunk or file in the change. Fix: extract the shared shape and call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. Fix: move the method onto the data it envies.
- **Data Clumps**: the same few fields or params keep travelling together (a type wanting to be born). Fix: bundle them into one type and pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept that deserves its own type. Fix: give the concept its own small type.
- **Repeated Switches**: the same `switch` or `if` cascade on the same type recurs across the change. Fix: replace it with polymorphism, or one map both sites share.
- **Shotgun Surgery**: one logical change forces scattered edits across many files in the diff. Fix: gather what changes together into one module.
- **Divergent Change**: one file or module is edited for several unrelated reasons. Fix: split it so each module changes for one reason.
- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. Fix: delete it; inline back until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. Fix: hide the walk behind one method on the first object.
- **Middle Man**: a class or function that mostly just delegates onward. Fix: cut it and call the real target direct.
- **Refused Bequest**: a subclass or implementer that ignores or overrides most of what it inherits. Fix: drop the inheritance and use composition.

A smell is a labelled heuristic ("possible Feature Envy"), so it is always a judgement call, never a hard violation.

