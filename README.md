# Lead Distribution

An in-memory engine that routes incoming leads to licensed, online agents, balances their workload, and queues leads that no one can take yet.

## Running it

Requires **Node 22.18+** (tested on Node 24).

```sh
npm test        # 16 tests, using Node's built-in test runner
npm run demo    # plays a short scenario and prints each assignment
```

Without npm: `node --test app.test.ts` and `node demo.ts`. 


| File          | What's in it                                            |
| ------------- | ------------------------------------------------------- |
| `app.ts`      | `LeadDistro` (queues and matching) and `Agent`          |
| `app.test.ts` | Tests for eligibility, queueing, capacity and balancing |
| `demo.ts`     | A walkthrough scenario with a final summary table       |


## How it works

Matching happens at two moments.

**Push, when a lead arrives** (`addLead`). The lead goes straight to the best eligible agent. If there isn't one, it joins the queue for its state.

**Pull, when an agent frees up** (joins, comes online, or finishes a lead). The agent takes the oldest waiting lead across all the states it's licensed in, and repeats until it's full or nothing is left.

An agent is **eligible** for a lead if it is online, licensed in the lead's state, and below its `maxLead`. Among eligible agents, the winner is picked by:

1. **Lowest workload**, measured as leads held ÷ `maxLead`. An idle agent with room for 3 beats an agent at 6 of 10, even though the second has more open slots.
2. **Longest wait since the last assignment**, on a workload tie.
3. **Earliest added**, if they're still tied.

Supporting details:

- **Queues:** each state has its own queue. Every lead is stamped with a logical clock on arrival, so a pull can compare ages across states.
- **Lead tracking:** each agent keeps the IDs of the leads it holds, and its workload is the size of that set. `finishLead(id)` ignores IDs the agent doesn't hold, so a duplicate "finished" event can't free a slot twice.
- **Going offline:** an offline agent receives nothing, by push or by pull. It keeps the leads it already holds.

## Assumptions

- Leads are assigned automatically; agents can't accept or reject them.
- An agent's licensed states don't change.
- Time is a logical counter, not wall-clock time. It only orders events.
- Everything runs in a single process, in memory.

