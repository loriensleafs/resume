### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec or task requirements? Report every requirement the spec asked for that is missing or partial.
- Does it add behaviour the spec did not ask for? Report each addition as **scope creep**. It is a finding, not a bonus.
- Does any requirement look implemented but wrong on reading? Report it.
- Quote the spec line for each of the three kinds of finding above.
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Do the tests cover the behaviour the spec names, not the implementation details?
- Are there off-by-one errors, race conditions, or state inconsistencies?

