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

import sqlite3, { Database } from 'sqlite3'
let sql;

const db = new Database('./db.db')

// === Tables ===
db.exec(`
    CREATE TABLE IF NOT EXISTS agent (
        id TEXT PRIMARY KEY,
        name TEXT,
        lead_count NUMBER,
        max_lead NUMBER,
        last_lead TIMESTAMP,

    )
    `)

db.exec(`
    CREATE TABLE IF NOT EXISTS lead (
        id TEXT PRIMARY KEY,
        s_id NUMBER NOT NULL,
        a_id TEXT,
        name TEXT,
        phone_number TEXT,
        email TEXT,   
        FOREIGN KEY (s_id) REFERENCES state (id)
        FOREIGN KEY (a_id) REFERENCES agents (id)
    )
    `)

db.exec(`
        CREATE TABLE IF NOT EXISTS state (
            id NUMBER PRIMARY KEY,
            name TEXT,
        )
        `
)

db.exec(`
        CREATE TABLE IF NOT EXISTS state_agent (
            a_id TEXT,
            s_id NUMBER,
            FOREIGN KEY (a_id) REFERENCES agent (id)
            FOREIGN KEY (s_id) REFERENCES state (id)
        )
        `)

