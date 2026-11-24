import type { DeckQuestion } from '../../shared/questions.ts'

export default [
  // The Alibi
  { id: 'case-files-001', text: 'You were caught at 3am carrying forty rubber ducks out of a bowling alley. What is your alibi?', chaos: 2, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers', placeholder: 'okay so first of all…' },
  { id: 'case-files-002', text: 'Staff found you asleep in a furniture store display bed an hour after closing. What is your alibi?', chaos: 1, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers', placeholder: 'i was testing it for' },
  { id: 'case-files-003', text: 'A library book came back 14 years late with a sandwich inside. It was you. What is your alibi?', chaos: 1, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers', placeholder: 'the sandwich was a bookmark' },
  { id: 'case-files-004', text: 'You were spotted at a petting zoo in a fake mustache and a name tag that says Greg. What is your alibi?', chaos: 2, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers' },
  { id: 'case-files-005', text: 'You were seen directing parking lot traffic with two baguettes. What is your alibi?', chaos: 2, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers', placeholder: 'someone had to step up' },
  { id: 'case-files-006', text: 'The stadium big screen caught you eating a stranger\'s nachos. What is your alibi?', chaos: 3, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers' },
  { id: 'case-files-007', text: 'Your neighbor saw you burying a microwave in the backyard at midnight. What is your alibi?', chaos: 3, rounds: ['alibi'], tags: ['alibi'], familiarity: 'strangers', placeholder: 'it knew too much' },
  { id: 'case-files-008', text: 'You appear in the background of five photos at a wedding you were not invited to. What is your alibi?', chaos: 3, rounds: ['alibi'], tags: ['alibi'], familiarity: 'friends' },
  { id: 'case-files-009', text: 'You were caught in a public park rehearsing a breakup speech to a houseplant. What is your alibi?', chaos: 4, rounds: ['alibi'], tags: ['alibi'], familiarity: 'friends' },
  { id: 'case-files-010', text: 'Your crush walked in while you were rehearsing a conversation with them, doing both voices. What is your alibi?', chaos: 4, rounds: ['alibi'], tags: ['alibi', 'crushes'], familiarity: 'friends', placeholder: 'it was a play. a school play.' },
  { id: 'case-files-011', text: 'This group has proof you left our call, then joined a different call with other friends. What is your alibi?', chaos: 5, rounds: ['alibi'], tags: ['alibi', 'group'], familiarity: 'close', placeholder: 'i can explain' },
  { id: 'case-files-012', text: 'Someone here has a screenshot of you liking your own selfie from three accounts. What is your alibi?', chaos: 5, rounds: ['alibi'], tags: ['alibi', 'group'], familiarity: 'close' },

  // PR Disaster
  { id: 'case-files-013', text: 'You accidentally became the mayor of a small town for 48 hours. Write your public apology.', chaos: 1, rounds: ['pr-disaster'], tags: ['apology'], familiarity: 'strangers', placeholder: 'to everyone affected…' },
  { id: 'case-files-014', text: 'Your bake sale cookies were made with salt instead of sugar and the whole school ate them. Write the apology.', chaos: 1, rounds: ['pr-disaster'], tags: ['apology', 'food'], familiarity: 'strangers', placeholder: 'we have heard your concerns' },
  { id: 'case-files-015', text: 'You lost a staring contest to a goose on live TV and it went viral. Release a statement.', chaos: 2, rounds: ['pr-disaster'], tags: ['apology'], familiarity: 'strangers' },
  { id: 'case-files-016', text: 'You hit reply-all to the entire company with a photo of your cat in a tiny hat. Write the apology.', chaos: 2, rounds: ['pr-disaster'], tags: ['apology', 'work'], familiarity: 'strangers', placeholder: 'effective immediately' },
  { id: 'case-files-017', text: 'You single-handedly made socks with sandals the hottest trend in your city. Release a statement.', chaos: 2, rounds: ['pr-disaster'], tags: ['apology', 'fashion'], familiarity: 'strangers' },
  { id: 'case-files-018', text: 'Your pet goldfish\'s social media account was caught buying followers. Issue a statement on its behalf.', chaos: 3, rounds: ['pr-disaster'], tags: ['apology', 'pets'], familiarity: 'strangers', placeholder: 'bubbles would like to say' },
  { id: 'case-files-019', text: 'You turned a wedding\'s first dance into a conga line that lasted three hours. Write the apology.', chaos: 3, rounds: ['pr-disaster'], tags: ['apology', 'weddings'], familiarity: 'strangers' },
  { id: 'case-files-020', text: 'You fell asleep at your own surprise party and snored through every toast. Write the apology.', chaos: 3, rounds: ['pr-disaster'], tags: ['apology', 'parties'], familiarity: 'friends' },
  { id: 'case-files-021', text: 'While snooping on a profile, you liked a photo from 2014 and they noticed. Release a statement.', chaos: 4, rounds: ['pr-disaster'], tags: ['apology', 'snooping'], familiarity: 'friends', placeholder: 'my thumb acted alone' },
  { id: 'case-files-022', text: 'Your voice memo ranting about a date was sent to the date. Write the apology.', chaos: 4, rounds: ['pr-disaster'], tags: ['apology', 'dating'], familiarity: 'friends' },
  { id: 'case-files-023', text: 'You were caught narrating this group\'s calls like a nature documentary on a public stream. Apologize to the group.', chaos: 5, rounds: ['pr-disaster'], tags: ['apology', 'group'], familiarity: 'close', placeholder: 'dear valued friends' },
  { id: 'case-files-024', text: 'You leaked this group chat to a podcast "for content purposes". Write the public apology.', chaos: 5, rounds: ['pr-disaster'], tags: ['apology', 'group'], familiarity: 'close' },

  // Anonymous Complaints
  { id: 'case-files-025', text: 'Submit a formal complaint about this group\'s voice call etiquette.', chaos: 1, rounds: ['complaints'], tags: ['complaint', 'voice'], familiarity: 'strangers', placeholder: 'to whom it may concern' },
  { id: 'case-files-026', text: 'File a complaint about how long it takes this group to pick a game to play.', chaos: 1, rounds: ['complaints'], tags: ['complaint', 'gaming'], familiarity: 'strangers' },
  { id: 'case-files-027', text: 'Submit a complaint about this group\'s unofficial snack-sharing policy.', chaos: 1, rounds: ['complaints'], tags: ['complaint', 'food'], familiarity: 'strangers', placeholder: 'section 4, paragraph 2' },
  { id: 'case-files-028', text: 'File a complaint about the plans this group makes that never actually happen.', chaos: 2, rounds: ['complaints'], tags: ['complaint', 'plans'], familiarity: 'friends' },
  { id: 'case-files-029', text: 'Leave a one-star review of this friend group as if it were a restaurant.', chaos: 2, rounds: ['complaints'], tags: ['complaint', 'reviews'], familiarity: 'friends', placeholder: 'the ambience was' },
  { id: 'case-files-030', text: 'Write to management about the current quality of memes in the group chat.', chaos: 2, rounds: ['complaints'], tags: ['complaint', 'memes'], familiarity: 'friends' },
  { id: 'case-files-031', text: 'Submit a complaint about this group\'s photo policy, specifically who always ends up blurry.', chaos: 3, rounds: ['complaints'], tags: ['complaint', 'photos'], familiarity: 'friends' },
  { id: 'case-files-032', text: 'File a noise complaint about one specific laugh in this group, without naming names.', chaos: 3, rounds: ['complaints'], tags: ['complaint', 'voice'], familiarity: 'friends', placeholder: 'it is a certain pitch' },
  { id: 'case-files-033', text: 'File a complaint about this group\'s response time to messages that actually matter.', chaos: 4, rounds: ['complaints'], tags: ['complaint', 'texting'], familiarity: 'friends' },
  { id: 'case-files-034', text: 'Submit a complaint about how this group behaves the moment anyone mentions a new crush.', chaos: 4, rounds: ['complaints'], tags: ['complaint', 'crushes'], familiarity: 'friends', placeholder: 'within four seconds' },
  { id: 'case-files-035', text: 'Write a formal letter to management requesting a full refund on this friendship.', chaos: 5, rounds: ['complaints'], tags: ['complaint', 'group'], familiarity: 'close', placeholder: 'i have been a loyal member since' },
  { id: 'case-files-036', text: 'File an official complaint about this group\'s secret ranking of who is the favorite.', chaos: 5, rounds: ['complaints'], tags: ['complaint', 'group'], familiarity: 'close' },

  // Unsent Message
  { id: 'case-files-037', text: 'Write the text you would send your microwave if it could read.', chaos: 1, rounds: ['unsent-message'], tags: ['message', 'objects'], familiarity: 'strangers', placeholder: 'we need to talk about the beeping' },
  { id: 'case-files-038', text: 'Write the message you would send to the alarm that has been ruining your mornings.', chaos: 1, rounds: ['unsent-message'], tags: ['message', 'mornings'], familiarity: 'strangers' },
  { id: 'case-files-039', text: 'Write a thank-you note to the one sock that never left you.', chaos: 2, rounds: ['unsent-message'], tags: ['message', 'objects'], familiarity: 'strangers', placeholder: 'through every laundry day' },
  { id: 'case-files-040', text: 'Write a passive-aggressive note to your younger self about their fashion choices.', chaos: 2, rounds: ['unsent-message'], tags: ['message', 'past self'], familiarity: 'strangers' },
  { id: 'case-files-041', text: 'Write a strongly worded message to whoever invented group projects.', chaos: 2, rounds: ['unsent-message'], tags: ['message', 'school'], familiarity: 'strangers', placeholder: 'i hope you are happy' },
  { id: 'case-files-042', text: 'Write the message you would send your autocorrect after years of betrayal.', chaos: 3, rounds: ['unsent-message'], tags: ['message', 'phone'], familiarity: 'strangers' },
  { id: 'case-files-043', text: 'Write the text you would send your bank account if it had feelings.', chaos: 3, rounds: ['unsent-message'], tags: ['message', 'money'], familiarity: 'strangers', placeholder: 'i know i have not been there for you' },
  { id: 'case-files-044', text: 'Write a message to your future self, who still has not started that hobby.', chaos: 3, rounds: ['unsent-message'], tags: ['message', 'future self'], familiarity: 'friends' },
  { id: 'case-files-045', text: 'Write a love letter to the snack you think about more than you should.', chaos: 4, rounds: ['unsent-message'], tags: ['message', 'food'], familiarity: 'friends', placeholder: 'my dearest' },
  { id: 'case-files-046', text: 'Write the 2am "you up?" text you would send your fridge.', chaos: 4, rounds: ['unsent-message'], tags: ['message', 'late night'], familiarity: 'friends' },
  { id: 'case-files-047', text: 'Write the dramatic farewell you would post if you were leaving this group chat forever.', chaos: 5, rounds: ['unsent-message'], tags: ['message', 'group'], familiarity: 'close', placeholder: 'i did not want it to end this way' },
  { id: 'case-files-048', text: 'This group chat just texted you "we need to talk". Write your reply.', chaos: 5, rounds: ['unsent-message'], tags: ['message', 'group'], familiarity: 'close' },
] satisfies DeckQuestion[]
