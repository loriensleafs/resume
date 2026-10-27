# The site lives at peterkloss.dev; pkloss.dev and pwk.dev redirect to it

Peter's first choices, peterkloss.com and pk.com, belong to other owners. On 2026-10-27 the .dev registry returned "not found" for peterkloss.dev, pkloss.dev and pwk.dev, so they appear to be free ([interview record](../design/interview-2026-10-26.md), question 28). Peter chose peterkloss.dev as the main address and the two short names as ways in.

Decided 2026-10-27 by Peter.

Consequences:

- pkloss.dev and pwk.dev send a permanent redirect to the same path on peterkloss.dev. They do not serve their own copy of the site. Browser storage belongs to one address, so a copy on three addresses would split a visitor's saved session ([decision 0017](0017-saved-visitor-session.md)) and the installed app across three sites. One address also keeps search results and shared links in one place.
- The installed app's start address and scope are on peterkloss.dev.
- Every .dev site must use HTTPS; Vercel provides it.
- Peter buys the three names; agents never buy. A registrar shows the real availability and price; a short name such as pwk.dev can carry a premium price. Vercel Pro includes one free first-year domain on eligible endings, including .dev ([research 07](../research/07-tanstack-ai-hosting-model.md)).
- The deploy spec adds the domains to the Vercel project and sets the redirects.
