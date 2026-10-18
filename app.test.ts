// Run with: node --test
import { describe, test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { LeadDistro, Agent, type State, type Lead } from './app.ts'

let leadID = 0
// `time` is stamped by LeadDistro.addLead
const mkLead = (state: State): Lead =>
    ({ id: leadID++, state, name: `lead${leadID}`, phoneNumber: '', email: '', time: 0 })

// builds a fresh distro and registers agents with it
function setup() {
    const distro = new LeadDistro()
    const mkAgent = (states: State[], maxLead = 5, online = true) => {
        const agent = new Agent(states, (a) => distro.assignAgent(a), maxLead, online)
        distro.addAgent(agent)
        return agent
    }
    const queued = (state: State) => distro.leadsByState.get(state)!.length
    return { distro, mkAgent, queued }
}

describe('LeadDistro', () => {
    // silence LeadDistro logging
    beforeEach(() => { mock.method(console, 'log', () => { }) })
    afterEach(() => { mock.restoreAll() })

    describe('eligibility', () => {
        test('lead goes to an online agent licensed in that state', () => {
            const { distro, mkAgent } = setup()
            const a = mkAgent(['California'])
            distro.addLead(mkLead('California'))
            assert.equal(a.getLeadCount(), 1)
        })

        test('lead is not given to an agent in a different state', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['Texas'])
            distro.addLead(mkLead('California'))
            assert.equal(a.getLeadCount(), 0)
            assert.equal(queued('California'), 1)
        })

        test('lead is not given to an offline agent', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['California'], 5, false)
            distro.addLead(mkLead('California'))
            assert.equal(a.getLeadCount(), 0)
            assert.equal(queued('California'), 1)
        })

        test('a lead is assigned to exactly one agent', () => {
            const { distro, mkAgent } = setup()
            const a = mkAgent(['Utah'])
            const b = mkAgent(['Utah'])
            distro.addLead(mkLead('Utah'))
            assert.equal(a.getLeadCount() + b.getLeadCount(), 1)
        })
    })

    describe('queue', () => {
        test('queued lead is pulled when an agent comes online', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['California'], 5, false)
            distro.addLead(mkLead('California'))
            a.setOnline()
            assert.equal(a.getLeadCount(), 1)
            assert.equal(queued('California'), 0)
        })

        test('queued lead is pulled when an agent finishes a lead', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['California'], 1)
            const first = mkLead('California')
            const second = mkLead('California')
            distro.addLead(first)                  // fills the agent
            distro.addLead(second)                 // queued
            assert.equal(queued('California'), 1)
            a.finishLead(first.id)
            assert.deepEqual([...a.leadIds], [second.id])   // finished one, pulled one
            assert.equal(queued('California'), 0)
        })

        test('a new agent pulls up to maxLead from the backlog', () => {
            const { distro, mkAgent, queued } = setup()
            for (let i = 0; i < 5; i++) distro.addLead(mkLead('Ohio'))
            const a = mkAgent(['Ohio'], 3)
            assert.equal(a.getLeadCount(), 3)
            assert.equal(queued('Ohio'), 2)
        })

        test('pull takes the oldest lead across the agent\'s states', () => {
            const { distro, mkAgent, queued } = setup()
            distro.addLead(mkLead('Ohio'))         // arrives first, so oldest
            distro.addLead(mkLead('Texas'))
            mkAgent(['Texas', 'Ohio'], 1)
            assert.equal(queued('Ohio'), 0)
            assert.equal(queued('Texas'), 1)
        })

        test('an offline agent does not pull the backlog when added', () => {
            const { distro, mkAgent, queued } = setup()
            distro.addLead(mkLead('Nevada'))
            distro.addLead(mkLead('Nevada'))
            const a = mkAgent(['Nevada'], 5, false)
            assert.equal(a.getLeadCount(), 0)
            assert.equal(queued('Nevada'), 2)
        })

        test('an offline agent does not pull after finishing a lead', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['Ohio'], 1)
            const first = mkLead('Ohio')
            distro.addLead(first)
            distro.addLead(mkLead('Ohio'))         // queued
            a.setOffline()
            a.finishLead(first.id)
            assert.equal(a.getLeadCount(), 0)
            assert.equal(queued('Ohio'), 1)
        })

        test('finishing the same lead twice frees only one slot', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['Ohio'], 1)
            const first = mkLead('Ohio')
            distro.addLead(first)
            distro.addLead(mkLead('Ohio'))
            distro.addLead(mkLead('Ohio'))         // two queued
            a.finishLead(first.id)                 // pulls one
            a.finishLead(first.id)                 // already finished, ignored
            assert.equal(a.getLeadCount(), 1)
            assert.equal(queued('Ohio'), 1)
        })
    })

    describe('capacity', () => {
        test('agent never exceeds maxLead', () => {
            const { distro, mkAgent, queued } = setup()
            const a = mkAgent(['California'], 2)
            for (let i = 0; i < 5; i++) distro.addLead(mkLead('California'))
            assert.equal(a.getLeadCount(), 2)
            assert.equal(queued('California'), 3)
        })
    })

    // busy agents are also licensed in Nevada, so Nevada leads load them up without touching the others
    describe('workload balancing', () => {
        test('lead prefers the agent with the lighter workload (busy added first)', () => {
            const { distro, mkAgent } = setup()
            const busy = mkAgent(['Utah', 'Nevada'], 5)
            const idle = mkAgent(['Utah'], 5)
            for (let i = 0; i < 4; i++) distro.addLead(mkLead('Nevada'))
            distro.addLead(mkLead('Utah'))
            assert.equal(idle.getLeadCount(), 1)
            assert.equal(busy.getLeadCount(), 4)
        })

        test('lead prefers the agent with the lighter workload (idle added first)', () => {
            const { distro, mkAgent } = setup()
            const idle = mkAgent(['Utah'], 5)
            const busy = mkAgent(['Utah', 'Nevada'], 5)
            for (let i = 0; i < 4; i++) distro.addLead(mkLead('Nevada'))
            distro.addLead(mkLead('Utah'))
            assert.equal(idle.getLeadCount(), 1)
            assert.equal(busy.getLeadCount(), 4)
        })

        test('workload is relative to each agent\'s maxLead', () => {
            const { distro, mkAgent } = setup()
            const busy = mkAgent(['Florida', 'Nevada'], 10)
            const idle = mkAgent(['Florida'], 3)
            for (let i = 0; i < 6; i++) distro.addLead(mkLead('Nevada'))
            distro.addLead(mkLead('Florida'))      // 0/3 beats 6/10, despite fewer open slots
            assert.equal(idle.getLeadCount(), 1)
            assert.equal(busy.getLeadCount(), 6)
        })

        test('on a workload tie, the agent who waited longest since their last lead wins', () => {
            const { distro, mkAgent } = setup()
            const a = mkAgent(['Utah'], 2)
            const b = mkAgent(['Utah', 'Nevada'], 2)
            distro.addLead(mkLead('Nevada'))       // b's last lead
            distro.addLead(mkLead('Utah'))         // a, since 0/2 beats 1/2
            distro.addLead(mkLead('Utah'))         // tied at 1/2, b has waited longer
            assert.equal(b.getLeadCount(), 2)
            assert.equal(a.getLeadCount(), 1)
        })
    })
})
