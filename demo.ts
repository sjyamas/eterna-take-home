// Run with: node demo.ts
// Plays a short scenario. LeadDistro logs every step as
//   Add lead <lead> @ <time>    and    Assign <agent>: <lead> @ <time>
import { LeadDistro, Agent, type State, type Lead } from './app.ts'

const distro = new LeadDistro()
let nextLead = 1
const lead = (state: State): Lead => {
    const id = nextLead++
    return { id, state, name: `lead${id}`, phoneNumber: '', email: '', time: 0 }
}
const agent = (id: number, states: State[], maxLead: number, online = true) => {
    const a = new Agent(id, states, (x) => distro.assignAgent(x), maxLead, online)
    distro.addAgent(a)
    return a
}
const section = (title: string) => console.log(`\n== ${title}`)

section('Agents join: 0 (California + Nevada, max 2), 1 (California, max 3), 2 (Texas, max 2, offline)')
const a0 = agent(0, ['California', 'Nevada'], 2)
const a1 = agent(1, ['California'], 3)
const a2 = agent(2, ['Texas'], 2, false)

section('Leads are pushed to the eligible agent with the lowest workload')
distro.addLead(lead('California'))   // both at 0%, tie goes to agent 0 (added first)
distro.addLead(lead('California'))   // agent 1: 0/3 beats 1/2
distro.addLead(lead('California'))   // agent 1: 1/3 beats 1/2
distro.addLead(lead('Nevada'))       // agent 0: the only one licensed in Nevada

section('With no eligible agent, leads wait in their state\'s queue')
distro.addLead(lead('California'))   // agent 1 takes its last slot
distro.addLead(lead('California'))   // everyone in California is full: queued
distro.addLead(lead('Texas'))        // agent 2 is offline: queued

section('Agent 2 comes online and pulls the waiting Texas lead')
a2.setOnline()

section('Agent 0 finishes lead 1 and pulls the waiting California lead')
a0.finishLead(1)

section('Agent 1 goes offline, then finishes lead 2: offline agents don\'t pull')
distro.addLead(lead('California'))   // queued
a1.setOffline()
a1.finishLead(2)

section('Final state')
console.table([...distro.agents.values()].map(a => ({
    agent: a.id,
    states: a.states.join(', '),
    online: a.online,
    load: `${a.getLeadCount()}/${a.maxLead}`,
    leads: [...a.leadIds].join(', '),
})))
const waiting = [...distro.leadsByState]
    .filter(([, queue]) => queue.length)
    .map(([state, queue]) => `${state}: ${queue.map(l => l.id).join(', ')}`)
console.log('Waiting:', waiting.length ? waiting.join('; ') : 'none')
