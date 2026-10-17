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

import pkg from 'sqlite3';
const { Database } = pkg;
const db = new Database('./db.db')

// === Tables ===
db.exec(`
    DROP TABLE IF EXISTS agent;
    DROP TABLE IF EXISTS lead;
    DROP TABLE IF EXISTS state;
    DROP TABLE IF EXISTS state_agent;
    `
)
db.exec(`
    CREATE TABLE agent (
        id TEXT PRIMARY KEY,
        name TEXT,
        lead_count NUMBER,
        max_lead NUMBER,
        last_lead TIMESTAMP
    )
    `)

db.exec(`
    CREATE TABLE lead (
        id TEXT PRIMARY KEY,
        s_id NUMBER NOT NULL,
        a_id TEXT,
        name TEXT,
        phone_number TEXT,
        email TEXT,   
        FOREIGN KEY (s_id) REFERENCES state (id),
        FOREIGN KEY (a_id) REFERENCES agents (id)
    )
    `)

db.exec(`
        CREATE TABLE state (
            id NUMBER PRIMARY KEY,
            name TEXT
        )
        `
)

db.exec(`
        CREATE TABLE state_agent (
            a_id TEXT,
            s_id NUMBER,
            FOREIGN KEY (a_id) REFERENCES agent (id),
            FOREIGN KEY (s_id) REFERENCES state (id)
        )
        `)

// === Seed ===
let states = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"]
let statesMap = []
for (let i = 0; i < states.length; i++) {
    statesMap.push({ id: i + 1, name: states[i] })
}

const insertState = db.prepare(`
    INSERT INTO state (id, name)
    VALUES (?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

db.exec("BEGIN");
try {
    for (const state of statesMap) {
        insertState.run(state.id, state.name);
    }
} catch (error) {
    db.exec("ROLLBACK");
    throw error;
}
