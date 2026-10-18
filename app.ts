/*
=== Assumptions ===
- Available agents get assigned leads automatically. (No accept/reject)
- Agents cannot add or remove states they are licensed.


=== Functional requirements ===
- Match lead to agent

=== Non functional requirements ===
- consistency in matching (1 lead gets 1 agent)
- low latency matching
- handle bursts

=== Core entities ===
- Lead
    ID,
    name,
    phoneNumber,
    email,
    ...others

- Agent
    ID,
    status: 'online' | 'offline',
    leadCount,
    maxLead,
    lastLead,

=== APIs ===
PATCH /agent/status -> success | error
header: token
{
    status: 'online' | 'offline',
}

POST /lead -> Agent | Fail
{
    name,
    phoneNumber,
    email,
    ...others
}
*/
// === SETUP ===
// import pkg from 'sqlite3';
// const { Database } = pkg;
// const db = new Database('./db.db')

// // === Tables ===
// db.exec(`
//     DROP TABLE IF EXISTS agent;
//     DROP TABLE IF EXISTS lead;
//     DROP TABLE IF EXISTS state;
//     DROP TABLE IF EXISTS state_agent;
//     `
// )
// db.exec(`
//     CREATE TABLE agent (
//         id TEXT PRIMARY KEY,
//         name TEXT,
//         lead_count NUMBER,
//         max_lead NUMBER,
//         last_lead TIMESTAMP
//     )
//     `)

// db.exec(`
//     CREATE TABLE lead (
//         id TEXT PRIMARY KEY,
//         s_id NUMBER NOT NULL,
//         a_id TEXT,
//         name TEXT,
//         phone_number TEXT,
//         email TEXT,
//         FOREIGN KEY (s_id) REFERENCES state (id),
//         FOREIGN KEY (a_id) REFERENCES agents (id)
//     )
//     `)

// db.exec(`
//         CREATE TABLE state (
//             id NUMBER PRIMARY KEY,
//             name TEXT
//         )
//         `
// )

// db.exec(`
//         CREATE TABLE state_agent (
//             a_id TEXT,
//             s_id NUMBER,
//             FOREIGN KEY (a_id) REFERENCES agent (id),
//             FOREIGN KEY (s_id) REFERENCES state (id)
//         )
//         `)

// // === Seed States ===
// let states = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]
// let statesMap = []
// for (let i = 0; i < states.length; i++) {
//     statesMap.push({ id: i + 1, name: states[i] })
// }

// const insertState = db.prepare(`
//     INSERT INTO state (id, name)
//     VALUES (?, ?)
//     ON CONFLICT(id) DO NOTHING
//   `);

// db.exec("BEGIN");
// try {
//     for (const state of statesMap) {
//         insertState.run(state.id, state.name);
//     }
//     db.exec("COMMIT");
// } catch (error) {
//     db.exec("ROLLBACK");
//     throw error;
// }

/*
    class?
    run scheduler
    params
    - time elapsed

    public functions
    - add agent
    - add lead
    - edit agent
    - quit

    private functions
    - check agents (state)
    - check leads (states)
    - assign lead
    - pull leads (num leads, states[])
    - push lead ( state )

    when a lead arrives, it attempts to push
    when a status of a agent changes, it attempts to pull

*/

type State = "Alabama" | "Alaska" | "Arizona" | "Arkansas" | "California" | "Colorado" | "Connecticut" | "Delaware" | "Florida" | "Georgia" | "Hawaii" | "Idaho" | "Illinois" | "Indiana" | "Iowa" | "Kansas" | "Kentucky" | "Louisiana" | "Maine" | "Maryland" | "Massachusetts" | "Michigan" | "Minnesota" | "Mississippi" | "Missouri" | "Montana" | "Nebraska" | "Nevada" | "New Hampshire" | "New Jersey" | "New Mexico" | "New York" | "North Carolina" | "North Dakota" | "Ohio" | "Oklahoma" | "Oregon" | "Pennsylvania" | "Rhode Island" | "South Carolina" | "South Dakota" | "Tennessee" | "Texas" | "Utah" | "Vermont" | "Virginia" | "Washington" | "West Virginia" | "Wisconsin" | "Wyoming"
const states: State[] = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]

type Lead = { id: number, state: State, name: string, phoneNumber: string, email: string, time: number }

class LeadDistro {
    time = 0
    agents: Map<number, Agent> = new Map()
    leadsByState: Map<State, Lead[]> = new Map()

    constructor() {
        for (const state of states) {
            this.leadsByState.set(state, [])
        }
    }

    private tick() { return ++this.time }

    addAgent(agent: Agent) {
        console.log(`Add agent ${agent.id}`)
        this.agents.set(agent.id, agent)
        this.assignAgent(agent)

    }

    assignAgent(agent: Agent) {
        while (agent.maxLead > agent.currentLeads) {
            let oldest: Lead | undefined
            for (const state of agent.states) {
                const head = this.leadsByState.get(state)?.[0]
                if (head && (!oldest || head.time < oldest.time)) {
                    oldest = head
                }
            }
            if (oldest) {
                this.leadsByState.get(oldest.state)!.shift()
                agent.currentLeads++
                agent.lastLead = this.tick()
                console.log(`Assign ${agent.id}: ${oldest.id} @ ${agent.lastLead}`)
            } else {
                break;
            }
        }
    }


    addLead(lead: Lead) {
        lead.time = this.tick()
        console.log(`Add lead ${lead.id} @ ${lead.time}`)
        if (!this.assignLead(lead)) {
            this.leadsByState.get(lead.state)?.push(lead)
        }
    }

    assignLead(lead: Lead): boolean {
        /*
            Selection Process:
            - considered agents: agents that are online, eligible for that state, not at capacity
            - prioritize: current workload, last lead assigned

            structured as such to make other attributes easy to add
        */
        let bestAgent: Agent | undefined
        let bestWorkload = 0

        for (const agent of this.agents.values()) {
            if (!agent.online || !agent.states.includes(lead.state) || agent.currentLeads >= agent.maxLead) {
                continue
            }

            const workload = agent.maxLead - agent.currentLeads   // remaining capacity
            if (bestAgent) {
                // 1. more remaining capacity wins
                if (workload < bestWorkload) {
                    continue
                }
                // 2. on a tie, whoever has waited longest since their last lead wins
                if (workload === bestWorkload && agent.lastLead >= bestAgent.lastLead) {
                    continue
                }
            }

            bestAgent = agent
            bestWorkload = workload
        }

        if (!bestAgent) {
            return false
        }
        bestAgent.currentLeads++
        bestAgent.lastLead = this.tick()
        console.log(`Assign ${bestAgent.id}: ${lead.id} @ ${bestAgent.lastLead}`)
        return true
    }
}

let agentID = 0

class Agent {
    id: number
    states: State[]
    maxLead: number
    online: boolean
    pull: (agent: Agent) => void

    currentLeads = 0
    lastLead = 0

    constructor(states: State[], pull: (agent: Agent) => void, maxLead = 5, online = true) {
        this.id = agentID++
        this.states = states
        this.maxLead = maxLead
        this.online = online
        this.pull = pull
    }

    finishLead() {
        this.currentLeads--
        this.pull(this)
    }

    setOnline() {
        this.online = true
        this.pull(this)
    }

    setOffline() {
        this.online = false
    }
}