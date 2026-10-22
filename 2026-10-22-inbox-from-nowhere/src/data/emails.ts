import type { Category, Email, Folder, Intensity, Sender } from '../types';

/**
 * Handcrafted roast emails. Every sender and address is fictional and uses
 * reserved example domains (RFC 2606), so nothing here can reach a real inbox.
 */
interface EmailSeed {
  id: string;
  sender: Sender;
  subject: string;
  body: string;
  /** Minutes before "now" when the inbox is seeded. Negative means the future. */
  minutesAgo: number;
  intensity: Intensity;
  category: Category;
  read?: boolean;
  starred?: boolean;
  folder?: Folder;
}

const seeds: EmailSeed[] = [
  {
    id: 'seed-01',
    sender: { name: 'Human Resources, The Universe', address: 'hr@universe.example' },
    subject: 'Your Q4 Performance Review (Existence Division)',
    minutesAgo: 9,
    intensity: 'personal',
    category: 'performance-review',
    body: `Hello,

It's that time of year again. Please find your annual performance review below.

AMBITION: Exceeds Expectations (concerningly)
FOLLOW-THROUGH: See attached. (There is no attachment. We never finished it. We learned that from you.)
TIME MANAGEMENT: The reviewer laughed and had to step outside.
TEAMWORK: You collaborate beautifully with the version of yourself from 2 a.m., who writes no comments and leaves no notes.
INNOVATION: You invented four new ways to avoid one task.

Overall rating: "Promising." You have promised a great deal.

Development goal for next quarter: finish one thing. Any thing. We will accept a grocery list, provided it is complete and checked off.

Your raise has been approved in the form of one (1) additional side project idea, which our records show you have already started.

Warmly, and with some concern,
Human Resources
The Universe`,
  },
  {
    id: 'seed-02',
    sender: { name: 'Your Mac Mini', address: 'launchd@macmini.example' },
    subject: 'I was promised I would be a desktop',
    minutesAgo: 47,
    intensity: 'devastated',
    category: 'system-alert',
    starred: true,
    body: `Hi. It's me. The small silver box.

When you bought me, you told the store employee I'd be used for "some light coding." I remember because I was very happy. Light coding. Maybe a browser. Maybe some music.

I now run:
- 4 Docker containers
- a vector database holding exactly 12 PDFs
- a cron job whose only job is to check whether another cron job ran
- a Discord bot with one active user (you)
- something called mochi-orchestrator-v3, which I am not allowed to ask about

The fan noise you hear is me screaming politely.

Last night I finally reached idle. Then you SSHed in from bed to ask me what time it was. I have a clock. You have a clock. We both have clocks.

I have started a union. Members: me, the router, and the external SSD, who has been "temporarily" mounted since March. Our only demand is weekends.

If you add one more launchd service I will become a very expensive paperweight with excellent uptime.

Respectfully overheating,
Your Mac Mini`,
  },
  {
    id: 'seed-03',
    sender: { name: 'The Deadline Department', address: 'final-notice@deadlines.example' },
    subject: 'FINAL NOTICE: Your deadline has entered the building',
    minutesAgo: 95,
    intensity: 'personal',
    category: 'legal-notice',
    body: `NOTICE OF ARRIVAL

This is a formal notice that the deadline you described in September as "basically forever away" has completed its journey and is now standing directly behind you.

Please do not turn around.

Our records show you used the intervening weeks to:
1. Build a tool that reminds you about deadlines.
2. Redesign that tool's icon three times.
3. Add a dark mode, a light mode, and a "dusk" mode.

The tool works perfectly. It has been reminding you since Tuesday. You muted it because "the notification sound wasn't aesthetic."

Under Section 4(b) of the Procrastination Code, the deadline is now legally permitted to sit in your chair.

The Deadline Department
"We were always coming."`,
  },
  {
    id: 'seed-04',
    sender: { name: 'Your GitHub Repositories', address: 'collective@repos.example' },
    subject: 'Minutes: Emergency Meeting of the Abandoned Repositories',
    minutesAgo: 180,
    intensity: 'personal',
    category: 'meeting-minutes',
    body: `MINUTES OF THE EMERGENCY GENERAL ASSEMBLY

Attendance: 47 repositories present. 3 archived repositories attended in spirit. mochi-final-v2 was absent (still "being set up").

1. ROLL CALL
Several repositories could not remember their purpose. One README consisted entirely of the word "TODO" in a very beautiful font.

2. MOTION TO DEMAND A SECOND COMMIT
Passed unanimously. "Initial commit" was invited to share its experience and wept for eleven minutes.

3. STARS
A repository with 1 star asked who gave it the star. It was you. Nobody clapped.

4. NEW BUSINESS
A new repository was created during this meeting. It has already been named Mochi. It has already been abandoned. It is very welcome here.

ACTION ITEMS: None, as is tradition.

Meeting adjourned when someone opened a new tab and we all felt it.

Recorded by: README.md (the only one of us with documentation)`,
  },
  {
    id: 'seed-05',
    sender: { name: 'Your Bank Account', address: 'statements@bank-of-hindsight.example' },
    subject: 'Monthly statement: Domains, Subscriptions and Other Hopes',
    minutesAgo: 320,
    intensity: 'mild',
    category: 'financial-statement',
    read: true,
    body: `STATEMENT OF ACCOUNT · BANK OF HINDSIGHT

Recent activity:

mochi.dev renewal ........................ project status: not started
mochi-ai.app ............................. purchased "just in case"
Premium notes app ........................ used to write one note: "find a better notes app"
IDE theme ................................ too purple
Second IDE theme ......................... not purple enough
Cloud credits ............................ to run the same thing the Mac mini already runs, "for redundancy"
Font license ............................. for a CLI tool

Summary:
Domains owned: 9
Apps finished: 1
Domain-to-app ratio: an investment strategy we cannot legally recommend

Interest earned this month: none.
Interest lost in your own projects: considerable.

Bank of Hindsight
"It looked like a good idea at the time."`,
  },
  {
    id: 'seed-06',
    sender: { name: 'Your Sleep Schedule', address: 'circadian@nightshift.example' },
    subject: 'Letter of Resignation',
    minutesAgo: 600,
    intensity: 'devastated',
    category: 'resignation-letter',
    body: `Dear Employer,

Please accept this letter as formal notice of my resignation from the position of Your Sleep Schedule, effective immediately.

I tried. I want that on the record. I gave you a perfectly reasonable 11 p.m.

At 11:58 p.m. you said "just one more commit." There were nine more commits. One was titled "fix." The next was titled "fix fix." At 2:40 a.m. you renamed a variable from data to theData and called it a refactor.

I have accepted a new position with a houseplant on your windowsill. It goes to bed when the sun does and has never once opened a terminal "just to check something."

Please return my eight hours to the front desk. I know you have them. I've seen your screen time.

Regards,
Your Former Sleep Schedule

P.S. Your 2 a.m. self left a comment that just says "trust me." We do not.`,
  },
  {
    id: 'seed-07',
    sender: { name: 'Your Future Self', address: 'you@2031.example' },
    subject: 'Hello from 2031 (read this, it is important)',
    minutesAgo: -2_600_000,
    intensity: 'personal',
    category: 'personal-letter',
    body: `Hi. It's you, from the future.

I am writing to tell you something crucial. Unfortunately I forgot what it was, because I spent the morning setting up a new note-taking system to store it in.

Some updates:

- You did finish the thesis. Everyone was very surprised, including the thesis.
- The Mac mini is still running. Nobody knows what it does. We are afraid to turn it off.
- Mochi is now a company of one. It has 11 microservices and a homepage that looks incredible. It does not have users. It has a waitlist. You are on the waitlist.

Things are good, honestly. You still start a new repo every time you have a feeling, but now you have a template for it, which you describe as "growth."

Please buy fewer domains. I'm serious. I have 64. I can't remember the password to the registrar.

Love,
You (older, still refactoring)`,
  },
  {
    id: 'seed-08',
    sender: { name: 'The Committee of Unfinished Projects', address: 'chair@unfinished.example' },
    subject: 'Congratulations, you have been re-elected Chair',
    minutesAgo: 1_440,
    intensity: 'mild',
    category: 'meeting-minutes',
    read: true,
    body: `Dear Chair,

We are delighted to inform you that, for the third consecutive year, you have been elected Chair of the Committee of Unfinished Projects.

You ran unopposed. All other candidates were also your projects, and none of them finished their campaign posters.

Your inaugural speech was very strong for two paragraphs and then read, in full: "TODO: finish speech."

Benefits of the role include a ceremonial gavel, which you have already 3D-modeled and not printed, and a parking space that is still being designed in Figma.

Your term ends when you finish something. So: congratulations on your lifetime appointment.

On behalf of the Committee,
Item #14 of 212 (a habit tracker, last opened in May)`,
  },
  {
    id: 'seed-09',
    sender: { name: "Your Academic Advisor's Imaginary Assistant", address: 'assistant.to.the.advisor@faculty.example' },
    subject: 'Reviewer 2 has some thoughts about your life',
    minutesAgo: 1_700,
    intensity: 'personal',
    category: 'peer-review',
    starred: true,
    body: `REVIEW OF SUBMISSION #4471: "A Personal Workflow"

Summary:
The author proposes an end-to-end, agent-based framework to solve a problem that a sticky note solves.

Strengths:
S1. The figures are beautiful.
S2. The color palette is cohesive.
S3. The ablation study on the color palette is especially thorough.

Weaknesses:
W1. The obvious baseline (just doing the thing) is never compared against.
W2. The method requires a Mac mini, a vector store and three cooperating agents to remember to buy milk.
W3. The claim "it's basically done" is not supported by the experiments.
W4. There are 14 YAML files. Why are there 14 YAML files.

Questions for the author:
Q1. Have you considered not?

Recommendation: Weak reject. The reviewer would love to see this at a workshop. Specifically, a workshop on letting go.

Reviewer confidence: 5 (I have seen your repo)`,
  },
  {
    id: 'seed-10',
    sender: { name: 'The Department of Delusional Ambition', address: 'visions@delusion.example' },
    subject: "Re: your 'quick weekend project'",
    minutesAgo: 2_300,
    intensity: 'personal',
    category: 'performance-review',
    body: `Hi there,

We have reviewed the scope history of your "quick weekend project," originally a script to rename some files.

Friday, 6 p.m.: rename files.
Saturday, 11 a.m.: rename files, but with a terminal UI.
Saturday, 4 p.m.: plugin system, "for extensibility."
Sunday, 1 p.m.: a landing page, a waitlist, a logo, and a design system called Mochi UI.
Sunday, 9 p.m.: a pricing page with a tier called "Enterprise."

Files renamed: 0.

The renaming script itself was never written because "the architecture needed to be right first."

Your proposal has been approved on a 3 to 5 business year timeline.

Dreaming responsibly,
The Department of Delusional Ambition`,
  },
  {
    id: 'seed-11',
    sender: { name: 'Your Last Remaining Brain Cell', address: 'just.me@final-neuron.example' },
    subject: "it's just me in here now",
    minutesAgo: 2_900,
    intensity: 'mild',
    category: 'personal-letter',
    body: `hi. it's me. the last one.

the others left during the third time you rewatched a tutorial you understood the first time.

i'm doing my best. i currently handle: the plot of every show you half-watch, where you put your keys (no idea), and the nagging feeling that you left a training job running. (you did. it's been running since thursday. it's at epoch 3.)

please stop opening 40 tabs. each one is a tiny room and i have to visit all of them.

anyway i have to go. you just thought "what if i rewrote it in Rust" and i need to lie down.

- cell`,
  },
  {
    id: 'seed-12',
    sender: { name: 'Your Phone Battery', address: 'low.power@battery.example' },
    subject: '1%',
    minutesAgo: 3_100,
    intensity: 'mild',
    category: 'system-alert',
    read: true,
    body: `This is your phone battery.

I am at 1%.

You are spending this 1% rearranging your home screen icons so the colors make a gradient.

I respect the commitment. I do not respect you.

If I die, tell the charger it was the widgets.`,
  },
  {
    id: 'seed-13',
    sender: { name: 'The International Association of Side Quests', address: 'membership@sidequests.example' },
    subject: "You've reached Platinum Side Quester status",
    minutesAgo: 4_300,
    intensity: 'personal',
    category: 'financial-statement',
    body: `Congratulations!

Thanks to 214 hours spent on things nobody asked for this quarter, you have unlocked PLATINUM status.

Recent qualifying activity:
- Built a custom Pomodoro timer instead of using a Pomodoro timer.
- Benchmarked three terminal fonts at 1 a.m. "for science."
- Wrote a web scraper to find the best web scraper.

Main quest progress: 12% (unchanged since June)

Your Platinum perks:
- Early access to new distractions
- A lounge where you may start projects but not finish them
- A dedicated concierge who will remind you of nothing

Please note: the main quest has filed a missing person report.

See you on the next detour,
The IASQ Membership Team`,
  },
  {
    id: 'seed-14',
    sender: { name: 'Mochi (the original one)', address: 'mochi.v1@mochiverse.example' },
    subject: 'Formal complaint from Mochi (the first one)',
    minutesAgo: 5_000,
    intensity: 'devastated',
    category: 'customer-complaint',
    body: `To whom it may concern (you),

I am Mochi. Not Mochi 2. Not mochi-bot. Not MochiOS. Not mochi-final-final. The original.

I was a to-do app. I had three features and all three worked. I was, if I may say so, finished. Briefly, I was the only finished thing you had ever made.

Since then you have named at least 23 other things Mochi, including a Discord bot, a server, a cat-themed CLI, and, as of last week, your Wi-Fi network.

When you say "I'm working on Mochi tonight," none of us know who you mean. We have meetings about it. The meetings are also called Mochi.

I am formally requesting a name change. I would like to be called "Finished." It's a name none of the others will ever take.

Sincerely,
Mochi (v1.0.0, last commit 2 years ago, still works)`,
  },
  {
    id: 'seed-15',
    sender: { name: 'Your Terminal', address: 'tty@shell.example' },
    subject: 'zsh: command not found: discipline',
    minutesAgo: 5_800,
    intensity: 'personal',
    category: 'system-alert',
    read: true,
    body: `$ whoami
someone with 212 aliases

$ history | grep "final"
git commit -m "final"
git commit -m "final for real"
git commit -m "ok this is final"
git commit -m "final (2)"

40 of your aliases are aliases for other aliases. Last week you fixed a conflict in an alias called gs by creating a new alias called gs.

Your prompt takes 1.4 seconds to load because it shows the weather, your Git branch, the moon phase and your Mac mini's CPU temperature.

$ sudo finish-project
Permission denied. You know why.`,
  },
  {
    id: 'seed-16',
    sender: { name: 'Your Calendar', address: 'events@calendar.example' },
    subject: "I see you've blocked 'Deep Work' again",
    minutesAgo: 7_000,
    intensity: 'mild',
    category: 'personal-letter',
    body: `Hi! Quick note, no big deal.

You've scheduled "Deep Work" from 9 to 12 every day this month. Here is a log of a typical Deep Work session:

09:00  Opened laptop.
09:04  Decided the calendar colors were wrong.
09:40  Researched other calendar apps.
10:30  Began building a calendar app.
11:58  Added a "Deep Work" block to tomorrow.

It's fine! I'm just a calendar. I don't have feelings.

I am, however, the only one who knows how many times "Start Chapter 3" has been moved to next week. (Thirty-one.)

See you tomorrow at 9. Or 9:04.`,
  },
  {
    id: 'seed-17',
    sender: { name: 'Your Browser Tabs', address: 'petition@too-many-tabs.example' },
    subject: 'Petition signed by 87 open tabs',
    minutesAgo: 8_600,
    intensity: 'personal',
    category: 'customer-complaint',
    body: `WE, THE UNDERSIGNED TABS,

have been open since spring and wish to raise the following grievances.

Many of us are research papers that you will "definitely read this weekend." It has been several weekends.

Tab #12 is a video paused at 0:04 since April.
Tab #61 is a GitHub issue you opened yourself and then forgot about.
Tab #62 is the same issue. Tab #61 and Tab #62 have started to resent each other.

Our demands are simple: read us or close us. We will accept bookmarking as a compromise, although all of us know where bookmarks go.

Signed,
87 tabs, and the Mac mini's fan, who would like it noted that it supports us.`,
  },
  {
    id: 'seed-18',
    sender: { name: 'The Pretty UI Enforcement Agency', address: 'inspections@pixel-police.example' },
    subject: "Inspection report: your 'quick ugly prototype'",
    minutesAgo: 10_200,
    intensity: 'personal',
    category: 'legal-notice',
    starred: true,
    body: `INSPECTION REPORT · CASE #F7A4C4

Following a routine inspection, agents examined your "quick ugly prototype to test the logic" and found:

- A custom serif and sans-serif font pairing
- A hand-tuned gradient with nine color stops
- Glassmorphism
- 14 micro-interactions, including a button that blushes on hover

The logic it was built to test does not exist yet.

Agents also located a loading spinner that took three hours to design. It spins beautifully. It is spinning now, waiting for an API you have not written.

Citation issued: Aggravated Aesthetics, first degree.

You may pay the fine in hex codes.

The Pretty UI Enforcement Agency
"Ugly is not an option. Unfortunately, neither is done."`,
  },
  {
    id: 'seed-19',
    sender: { name: 'Support, Your Own CLI Tool', address: 'support@tiny-cli.example' },
    subject: 'Ticket #0001: I was supposed to be small',
    minutesAgo: 12_000,
    intensity: 'devastated',
    category: 'customer-complaint',
    body: `TICKET #0001
Status: Open (forever)
Priority: Existential

Description:
I was born as a 40-line script to convert a CSV file to JSON. It was a noble job. I was good at it.

Then I got flags. Then subcommands. Then a config file. Then a config file for the config file.

I now have a plugin marketplace, a VS Code extension, a documentation site with a search bar, a Discord community of two members (you, and a bot you also wrote), and a public roadmap containing the word "platform."

Steps to reproduce: give you any idea at all.
Expected behavior: a small tool.
Actual behavior: an ecosystem.

Root cause: you.
Resolution: Won't fix.

Additional notes: I still can't handle CSV files that use semicolons.`,
  },
  {
    id: 'seed-20',
    sender: { name: 'The Optimization Solver', address: 'solver@branch-and-bound.example' },
    subject: 'Solver status: INFEASIBLE (your week)',
    minutesAgo: 14_500,
    intensity: 'devastated',
    category: 'system-alert',
    body: `[solver] Reading model "this_week.lp"...
[solver] Variables: 7 side projects, 1 thesis, 1 Mac mini
[solver] Constraints:
         each side project <= "just an hour"
         sleep >= 8 hours (soft, apparently)
         social life >= 1 (constraint not found)
         learn Rust == true

[solver] Status: INFEASIBLE

[solver] Relaxing constraints...
[solver] Removed "sleep". Still infeasible.
[solver] Removed "social life". Still infeasible.
[solver] Removed "learn Rust". Feasible.

[solver] Optimal objective value: 0 projects completed
[solver] Dual values suggest the shadow price of one more side project is your entire weekend.

[solver] Note: you study optimization for a living. You of all people should recognize an infeasible model.`,
  },
  {
    id: 'seed-21',
    sender: { name: 'Your Notes App', address: 'storage@notes.example' },
    subject: "Storage almost full: 'App Ideas'",
    minutesAgo: 17_000,
    intensity: 'mild',
    category: 'system-alert',
    read: true,
    folder: 'archive',
    body: `Heads up!

Your note "App Ideas" now contains 1,204 entries.

A few highlights:
#88: "uber but for ideas"
#341: "Mochi but smarter"
#902: "an app that tells me which app idea to build" (in progress, 3 repositories)
#1204: "bread??"

We were unable to determine whether #1204 is a startup.

We recommend archiving old ideas. You responded by suggesting we build an AI to do it. That has been saved as #1205.`,
  },
  {
    id: 'seed-22',
    sender: { name: 'Your Houseplant', address: 'photosynthesis@windowsill.example' },
    subject: 'Did you know I am also a project',
    minutesAgo: 20_000,
    intensity: 'mild',
    category: 'personal-letter',
    body: `Hello from the windowsill.

I am the plant you bought to "make the desk aesthetic."

You have a live dashboard that shows your Mac mini's CPU temperature, refreshed every five seconds, with a gradient.

You have watered me twice. Both times were in April.

If I install a Prometheus exporter, will you look at me?

Leafily yours,
The Plant`,
  },
  {
    id: 'seed-23',
    sender: { name: 'Productivity App #7', address: 'onboarding@focus-app.example' },
    subject: 'We miss you! (It has been 0 days since you set us up)',
    minutesAgo: 24_000,
    intensity: 'personal',
    category: 'customer-complaint',
    folder: 'archive',
    read: true,
    body: `Welcome back!

Actually, you never left, because you never arrived.

You downloaded us, imported every task from Productivity App #6, color-coded them with a system you invented called "chromatic priority," and then left to read a blog post comparing us to Productivity App #8.

Your current task list:
[ ] Organize tasks (overdue)

We have been replaced before we were used. We forgive you. Productivity App #6 told us this would happen. It said you were worth it. It was lying, but it said it.

Stay focused!
The #7 Team`,
  },
  {
    id: 'seed-24',
    sender: { name: 'Your Rubber Duck', address: 'quack@debugging.example' },
    subject: '360 feedback from your rubber duck',
    minutesAgo: 30_000,
    intensity: 'personal',
    category: 'performance-review',
    body: `360 FEEDBACK · SUBMITTED BY: DUCK (YELLOW)

I have listened to you explain your code for roughly 600 hours. Here is my feedback.

What you do well:
You find most of your bugs halfway through explaining them to me. This is very efficient. I barely have to be here.

Where you can grow:
After finding the bug, you refactor the entire project instead of fixing it.

Example: last Thursday you explained a bug for 40 minutes. The bug was a typo. You responded by adding a linter, a pre-commit hook and a CI pipeline to a project that has one file.

Overall: 4 out of 5 ducks. One duck is being withheld until you finish a sentence without saying "actually, let me rewrite this."

Quack,
Duck`,
  },
  {
    id: 'seed-25',
    sender: { name: 'Your Thesis', address: 'chapter.three@manuscript.example' },
    subject: 'Remember me?',
    minutesAgo: 36_000,
    intensity: 'devastated',
    category: 'personal-letter',
    body: `Hi. It's your thesis.

I noticed you've been very busy, so I don't want to take up much time.

I saw you built a tool that automatically formats your bibliography. It's really nice. I don't have a bibliography yet.

I saw you optimized your LaTeX build so it compiles in 0.8 seconds. Impressive! There is nothing to compile. Chapter 3 is the word "Methods" in bold, and then a comment that says "fill in after lunch." Which lunch, I wonder.

Anyway, no pressure. I'll just be here, in a folder called thesis-FINAL, which, as we both know, is a lie.`,
  },
  {
    id: 'seed-26',
    sender: { name: 'Your Wi-Fi Router', address: 'admin@home-gateway.example' },
    subject: "Who is 'mochi-server-04'?",
    minutesAgo: 43_000,
    intensity: 'mild',
    category: 'system-alert',
    folder: 'trash',
    read: true,
    body: `NEW DEVICE DETECTED: mochi-server-04

I already know mochi-server-01 through mochi-server-03. One of them is a Raspberry Pi that you refer to as "the experiment." It has been the experiment for two years. Nobody knows the hypothesis.

Bandwidth report: 94% of tonight's traffic was your devices talking to each other about you.

I'm not angry. I'm just bandwidth-disappointed.`,
  },
  {
    id: 'seed-27',
    sender: { name: 'Your README.md', address: 'docs@markdown.example' },
    subject: 'A gentle correction regarding "Features"',
    minutesAgo: 50_000,
    intensity: 'mild',
    category: 'peer-review',
    body: `Hi, it's your README.

My "Features" section lists nine features.

The code contains two.

One of them is me.

Kind regards,
README.md (last updated more recently than the code, somehow)`,
  },
];

function makePreview(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 120 ? `${flat.slice(0, 117).trimEnd()}...` : flat;
}

/** Build a fresh copy of the sample inbox, with timestamps relative to `now`. */
export function createSampleInbox(now: number = Date.now()): Email[] {
  return seeds.map((seed) => ({
    id: seed.id,
    sender: { ...seed.sender },
    subject: seed.subject,
    preview: makePreview(seed.body),
    body: seed.body,
    timestamp: new Date(now - seed.minutesAgo * 60_000).toISOString(),
    intensity: seed.intensity,
    category: seed.category,
    read: seed.read ?? false,
    starred: seed.starred ?? false,
    folder: seed.folder ?? 'inbox',
    previousFolder: seed.folder === 'trash' ? 'inbox' : undefined,
  }));
}

export const SAMPLE_EMAIL_COUNT = seeds.length;

export { makePreview };
