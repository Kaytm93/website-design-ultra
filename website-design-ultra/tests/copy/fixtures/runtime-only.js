// Copy assembled at runtime. The extractor cannot see it, and the linter must
// say so instead of reporting a pass over text it never read. Every line below
// is a Tier-1 hit that no rule will ever fire on.
const heading = document.createElement('h1')
heading.textContent = 'Unlock the full potential of your workflow'

const lead = document.createElement('p')
lead.textContent = "It's not just a note-taker. It's your team's second brain."

const proof = document.createElement('p')
proof.textContent = 'Experts agree that this is crucial for modern teams.'

document.body.append(heading, lead, proof)
