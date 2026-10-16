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


