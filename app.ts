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
*/

export type State = "Alabama" | "Alaska" | "Arizona" | "Arkansas" | "California" | "Colorado" | "Connecticut" | "Delaware" | "Florida" | "Georgia" | "Hawaii" | "Idaho" | "Illinois" | "Indiana" | "Iowa" | "Kansas" | "Kentucky" | "Louisiana" | "Maine" | "Maryland" | "Massachusetts" | "Michigan" | "Minnesota" | "Mississippi" | "Missouri" | "Montana" | "Nebraska" | "Nevada" | "New Hampshire" | "New Jersey" | "New Mexico" | "New York" | "North Carolina" | "North Dakota" | "Ohio" | "Oklahoma" | "Oregon" | "Pennsylvania" | "Rhode Island" | "South Carolina" | "South Dakota" | "Tennessee" | "Texas" | "Utah" | "Vermont" | "Virginia" | "Washington" | "West Virginia" | "Wisconsin" | "Wyoming"
const states: State[] = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]

export type Lead = { id: number, state: State, name: string, phoneNumber: string, email: string, time: number }

export class LeadDistro {
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
        if (!agent.online) return
        while (agent.maxLead > agent.getLeadCount()) {
            let oldest: Lead | undefined
            for (const state of agent.states) {
                const head = this.leadsByState.get(state)?.[0]
                if (head && (!oldest || head.time < oldest.time)) {
                    oldest = head
                }
            }
            if (oldest) {
                this.leadsByState.get(oldest.state)!.shift()
                agent.lastLead = this.tick()
                agent.leadIds.add(oldest.id)
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
            if (!agent.online || !agent.states.includes(lead.state) || agent.getLeadCount() >= agent.maxLead) {
                continue
            }

            // CHECK: ranks by open slots, not load, so an agent at 6/10 beats an idle agent at 0/3.
            // Doesn't match "prioritize: current workload" above; confirm which one you want.
            const workload = agent.getLeadCount() / agent.maxLead   // remaining capacity
            if (bestAgent) {
                // 1. more remaining capacity wins
                if (workload > bestWorkload) {
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
        bestAgent.lastLead = this.tick()
        bestAgent.leadIds.add(lead.id)
        console.log(`Assign ${bestAgent.id}: ${lead.id} @ ${bestAgent.lastLead}`)
        return true
    }
}

let agentID = 0

export class Agent {
    id: number
    states: State[]
    maxLead: number
    online: boolean
    pull: (agent: Agent) => void

    leadIds: Set<number> = new Set()
    lastLead = 0

    constructor(states: State[], pull: (agent: Agent) => void, maxLead = 5, online = true) {
        this.id = agentID++
        this.states = states
        this.maxLead = maxLead
        this.online = online
        this.pull = pull
    }

    getLeadCount() {
        return this.leadIds.size
    }

    finishLead(id: number) {
        if (this.leadIds.has(id)) {
            this.leadIds.delete(id)
            this.pull(this)
        }
    }

    setOnline() {
        this.online = true
        this.pull(this)
    }

    setOffline() {
        this.online = false
    }
}