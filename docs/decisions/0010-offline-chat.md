# Offline, the chat keeps its history and queues new questions

The model is reachable only online. Offline, past conversations stay readable from TanStack DB on the visitor's device, and a question asked offline is stored and sent when the connection returns. The same server model answers every question, so answers stay grounded.

Decided 2026-10-26 by Peter.

Considered: an on-device model for offline answers (large downloads, limited browser support, weaker and harder-to-ground answers); turning the chat off when offline.
